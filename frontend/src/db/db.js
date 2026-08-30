import Dexie from 'dexie';

export const db = new Dexie('paySphereDB');

db.version(1).stores({
  drafts: 'id, data, updatedAt', // id is the primary key (typically formId)
});
