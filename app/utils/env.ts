export function getEnv(key: string): string {
  if (typeof window !== 'undefined') {
    const envVars = (window as unknown as Record<string, unknown>).__DLP3D_ENV__ as
      | Record<string, string>
      | undefined
    if (envVars && envVars[key]) {
      return envVars[key]
    }
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]!
  }
  return ''
}
