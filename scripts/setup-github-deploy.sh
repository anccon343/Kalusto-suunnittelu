#!/usr/bin/env bash
# One-time setup for keyless deploys from GitHub Actions to Firebase (Roudari).
#
# Run in Google Cloud Shell (https://shell.cloud.google.com) as a project Owner:
#   bash setup-github-deploy.sh
#
# What it does (safe to run again; existing resources are kept):
#   1. Enables the Google APIs needed for deploys and Workload Identity Federation.
#   2. Creates the service account "github-deployer" with only the roles a deploy of
#      Hosting, Firestore rules and Firestore indexes needs.
#   3. Creates a Workload Identity pool and a GitHub OIDC provider that accepts only
#      this repository (by its numeric ids), the main branch and the "production"
#      environment, and lets it impersonate the service account.
# No keys are created or downloaded.
set -euo pipefail

PROJECT_ID="roudari-97f09"
EXPECTED_PROJECT_NUMBER="976934355295"
REPO="anccon343/Kalusto-suunnittelu"
REPO_ID="1468945115"       # numeric GitHub ids: immune to renames and name squatting
REPO_OWNER_ID="24986504"
SA_ID="github-deployer"
SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github"
PROVIDER_ID="kalusto-suunnittelu"
DEPLOY_ROLES=(
  roles/firebasehosting.admin               # Hosting sites, versions, releases
  roles/firebaserules.admin                 # Firestore security rules
  roles/datastore.indexAdmin                # Firestore indexes
  roles/serviceusage.serviceUsageConsumer   # the CLI checks that APIs are enabled
)

step() { printf '\n==> %s\n' "$*"; }

step "Project ${PROJECT_ID}"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
if [[ "$PROJECT_NUMBER" != "$EXPECTED_PROJECT_NUMBER" ]]; then
  echo "Project number is ${PROJECT_NUMBER}, expected ${EXPECTED_PROJECT_NUMBER}." >&2
  echo "Update .github/workflows/deploy.yml to match before deploying." >&2
fi

step "Enabling APIs (a billing error here means the plan needs Blaze; nothing else has changed yet)"
gcloud services enable \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com serviceusage.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com \
  firebaserules.googleapis.com firestore.googleapis.com

step "Service account ${SA_EMAIL}"
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_ID" \
    --display-name="GitHub Actions deployer" \
    --description="Deploys Roudari from ${REPO} (main) via Workload Identity Federation"
fi
for role in "${DEPLOY_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" --role="$role" --condition=None >/dev/null
  echo "  granted ${role}"
done

step "Workload Identity pool '${POOL_ID}'"
if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global --display-name="GitHub Actions"
fi

ATTRIBUTE_MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.environment=assertion.environment"
ATTRIBUTE_CONDITION="assertion.repository_owner_id == '${REPO_OWNER_ID}' && assertion.repository_id == '${REPO_ID}' && assertion.ref == 'refs/heads/main' && assertion.environment == 'production'"

step "OIDC provider '${PROVIDER_ID}' (only ${REPO}, branch main, environment production)"
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" --attribute-condition="$ATTRIBUTE_CONDITION"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" \
    --display-name="Kalusto-suunnittelu" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" --attribute-condition="$ATTRIBUTE_CONDITION"
fi

step "Allowing the repository to act as the service account"
POOL_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository_id/${REPO_ID}" \
  --condition=None >/dev/null

PROVIDER_NAME="$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --location=global --workload-identity-pool="$POOL_ID" --format='value(name)')"

step "Done"
echo "workload_identity_provider: ${PROVIDER_NAME}"
echo "service_account:            ${SA_EMAIL}"
echo "IAM changes can take up to 5 minutes to take effect."
