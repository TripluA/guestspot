interface PbFieldError {
  code?: string
  message?: string
}

interface PbErrorData {
  data?: Record<string, PbFieldError>
}

// PocketBase surfaces per-field validation details in `err.data.data[field]`
// while `err.message` stays generic ("Failed to create record."). Extract the
// real, human-readable reason(s) so users see what actually went wrong.
export function pbErrorMessage(err: unknown, t: (key: string) => string): string {
  const body = err && typeof err === 'object' ? (err as PbErrorData).data : undefined
  const fieldErrors =
    body && typeof body === 'object' && body.data && typeof body.data === 'object'
      ? Object.entries(body.data).filter(
          ([, info]) => info && typeof info.message === 'string' && info.message,
        )
      : []
  if (fieldErrors.length > 0) {
    return fieldErrors
      .map(([field, info]) => {
        if (field === 'number' && info.code === 'validation_not_unique') {
          return t('adminSpotNumberExists')
        }
        const key = fieldLabel(field)
        return `${key ? t(key) : field}: ${info.message}`
      })
      .join('\n')
  }
  return err instanceof Error && err.message ? err.message : ''
}

const FIELD_LABELS: Record<string, string> = {
  number: 'adminSpotNumber',
  building: 'building',
  zone: 'adminSpotZone',
  owner: 'adminSpotOwner',
  notes: 'reqNote',
  enabled: 'adminSpotEnabled',
  from: 'reqFrom',
  to: 'reqTo',
  guests: 'reqGuests',
  reason: 'spotsReason',
  name: 'registerName',
  email: 'registerEmail',
  password: 'registerPassword',
  apartment: 'registerApartment',
  phone: 'registerPhone',
  language: 'profileLanguage',
}

function fieldLabel(field: string): string | undefined {
  return FIELD_LABELS[field]
}
