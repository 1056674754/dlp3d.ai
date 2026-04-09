export interface Relationship {
  stage: string
  score: number
}

export enum RelationshipStage {
  Disliked = 'Disliked',
  Stranger = 'Stranger',
  Acquaintance = 'Acquaintance',
  Friend = 'Friend',
  Situationship = 'Situationship',
  Lover = 'Lover',
}
