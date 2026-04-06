// Stub module used during offline/Android static export builds.
// Replaces server-only routes (api/, dashboard/) that can't be statically exported.
// eslint-disable-next-line react/display-name
export default function EmptyStub() {
  return null
}
export async function generateStaticParams() {
  return [{ id: '_' }]
}
