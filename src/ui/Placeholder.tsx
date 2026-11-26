import { Stack, Text, Title } from '@mantine/core'

/** Temporary content for a view that is being built. */
export function Placeholder({ title }: { title: string }) {
  return (
    <Stack>
      <Title order={2}>{title}</Title>
      <Text c="dimmed">Tämä näkymä on rakenteilla.</Text>
    </Stack>
  )
}
