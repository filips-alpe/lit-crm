-- A record's project links go with it. The cascade is executed by the referential-integrity
-- trigger as the table owner, so it is not subject to row-level security: whoever may delete
-- a record (the write set) can delete it even when some of its links point at projects they
-- cannot read. The project-side foreign key is unchanged (a project with records is not deletable).
ALTER TABLE "lit_project_record" DROP CONSTRAINT "lit_project_record_recordId_fkey";
ALTER TABLE "lit_project_record" ADD CONSTRAINT "lit_project_record_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "lit_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;
