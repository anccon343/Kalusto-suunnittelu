import { Button, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { t } from './texts'

export function GigNotFound() {
  return (
    <Stack align="flex-start">
      <Title order={2}>{t.notFound.title}</Title>
      <Text>{t.notFound.body}</Text>
      <Button component={Link} to="/kalenteri" variant="default" size="md">
        {t.notFound.toCalendar}
      </Button>
    </Stack>
  )
}
