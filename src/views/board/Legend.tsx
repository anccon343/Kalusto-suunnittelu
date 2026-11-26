/** Explains the bar styles of the board; every swatch also carries text. */
import { Stack, Text } from '@mantine/core'
import { useId } from 'react'
import classes from './Board.module.css'
import { t } from './texts'

const swatch = (kind: string) => `${classes.bar} ${classes[kind] ?? ''} ${classes.swatch}`

export function Legend() {
  const id = useId()
  return (
    <Stack gap={4} component="section" aria-labelledby={id}>
      <Text id={id} size="xs" fw={600}>
        {t.legendTitle}
      </Text>
      <ul className={classes.legend}>
        <li className={classes.legendItem}>
          <span className={swatch('confirmed')} aria-hidden />
          {t.legend.confirmed}
        </li>
        <li className={classes.legendItem}>
          <span className={swatch('tentative')} aria-hidden>
            {t.tentativePrefix}
          </span>
          {t.legend.tentative}
        </li>
        <li className={classes.legendItem}>
          <span className={swatch('condition')} aria-hidden />
          {t.legend.condition}
        </li>
        <li className={classes.legendItem}>
          <span className={swatch('late')} aria-hidden />
          {t.legend.late}
        </li>
        <li className={classes.legendItem}>
          <span
            className={`${classes.mark} ${classes.swatch} ${classes.swatchText}`}
            data-severity="red"
            aria-hidden
          >
            {t.overlap}
          </span>
          {t.legend.overlap}
        </li>
        <li className={classes.legendItem}>
          <span
            className={`${classes.mark} ${classes.swatch} ${classes.swatchText}`}
            data-severity="yellow"
            aria-hidden
          >
            {t.warning}
          </span>
          {t.legend.warning}
        </li>
        <li className={classes.legendItem}>
          <span className={classes.transfer} aria-hidden>
            &gt;
          </span>
          {t.legend.transfer}
        </li>
        <li className={classes.legendItem}>
          <span className={classes.transfer} aria-hidden>
            {t.legend.quantityExample}
          </span>
          {t.legend.quantity}
        </li>
      </ul>
    </Stack>
  )
}
