import CharacterSettings from './CharacterSettings'

export async function generateStaticParams() {
  return [{ id: '_placeholder' }]
}

export default function Page() {
  return <CharacterSettings />
}
