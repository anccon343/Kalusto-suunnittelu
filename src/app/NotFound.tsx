import { Button, Stack, Text } from '@mantine/core'
import { Link } from 'react-router'
import { fi } from '../fi'

export function NotFound() {
  return (
    <Stack align="flex-start">
      <Text>{fi.notFoundPage}</Text>
      <Button component={Link} to="/" variant="default">
        {fi.nav.today}
      </Button>
    </Stack>
  )
}
