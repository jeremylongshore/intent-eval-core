/**
 * SkillSnapshot runtime validator (Blueprint B § 2.9).
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  Rfc3339Schema,
  SemVerSchema,
  Sha256Schema,
  StorageKeySchema,
  Uuidv7Schema,
} from './_primitives.js';

export const SkillSnapshotSchema = z
  .object({
    id: Uuidv7Schema,
    skill_id: KebabSlugSchema,
    source_sha: Sha256Schema,
    dependency_lock_sha: Sha256Schema,
    config_sha: Sha256Schema,
    /** Load-bearing: sha256(source_sha || dependency_lock_sha || config_sha). */
    combined_sha: Sha256Schema,
    version_label: SemVerSchema.nullable(),
    storage_key: StorageKeySchema,
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
    /** RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj). */
    tenant_id: Uuidv7Schema.optional(),
  })
  .strict();

export type SkillSnapshot = z.infer<typeof SkillSnapshotSchema>;
