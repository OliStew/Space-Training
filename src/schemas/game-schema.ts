import type { CollectionSchema } from 'deepspace/schema'

export const gameSchema: CollectionSchema = {
  name: 'game_state',
  columns: [
    { name: 'health', storage: 'number', interpretation: 'plain' },
    { name: 'oxygen', storage: 'number', interpretation: 'plain' },
    { name: 'sBucks', storage: 'number', interpretation: 'plain' },
    { name: 'gold', storage: 'number', interpretation: 'plain' },
    { name: 'gold', storage: 'number', interpretation: 'plain' },
    { name: 'gold', storage: 'number', interpretation: 'plain' }
  ],
  permissions: {
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin:  { read: true, create: true, update: true, delete: true },
  },
}