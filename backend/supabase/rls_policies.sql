-- Execute no SQL Editor do Supabase (uma vez).
-- Permite que usuarios autenticados (JWT do login) acessem os dados via API com anon key.

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    'USER'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'companyId', '')::integer,
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'companyId', '')::integer
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_role() = 'SUPER_ADMIN'
    OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN (
      'joaovictoralmeida474@gmail.com',
      'superadmin@conformix.local'
    );
$$;

CREATE OR REPLACE FUNCTION public.same_company(target_company_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR (
      public.auth_company_id() IS NOT NULL
      AND target_company_id = public.auth_company_id()
    );
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Company',
    'User',
    'Department',
    'Permission',
    'RolePermission',
    'UserPermission',
    'Category',
    'CategoryQuestion',
    'CategoryRequiredDocument',
    'Supplier',
    'Evaluation',
    'EvaluationAnswer',
    'RNC',
    'SupplierDocument',
    'AuditLog',
    'Alert'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS conformix_authenticated_all ON public.%I', table_name);
  END LOOP;
END $$;

CREATE POLICY conformix_company_select ON public."Company"
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.auth_company_id());

CREATE POLICY conformix_company_insert ON public."Company"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY conformix_company_update ON public."Company"
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY conformix_company_delete ON public."Company"
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY conformix_user_all ON public."User"
  FOR ALL TO authenticated
  USING (public.same_company("companyId"))
  WITH CHECK (public.same_company("companyId"));

CREATE POLICY conformix_department_all ON public."Department"
  FOR ALL TO authenticated
  USING (public.same_company("companyId"))
  WITH CHECK (public.same_company("companyId"));

CREATE POLICY conformix_permission_read ON public."Permission"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY conformix_permission_write ON public."Permission"
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY conformix_role_permission_read ON public."RolePermission"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY conformix_role_permission_write ON public."RolePermission"
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY conformix_user_permission_all ON public."UserPermission"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."User" target_user
      WHERE target_user.id = "UserPermission"."userId"
        AND public.same_company(target_user."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."User" target_user
      WHERE target_user.id = "UserPermission"."userId"
        AND public.same_company(target_user."companyId")
    )
  );

CREATE POLICY conformix_category_all ON public."Category"
  FOR ALL TO authenticated
  USING (public.same_company("companyId"))
  WITH CHECK (public.same_company("companyId"));

CREATE POLICY conformix_category_question_all ON public."CategoryQuestion"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Category" category
      WHERE category.id = "CategoryQuestion"."categoryId"
        AND public.same_company(category."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Category" category
      WHERE category.id = "CategoryQuestion"."categoryId"
        AND public.same_company(category."companyId")
    )
  );

CREATE POLICY conformix_category_document_all ON public."CategoryRequiredDocument"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Category" category
      WHERE category.id = "CategoryRequiredDocument"."categoryId"
        AND public.same_company(category."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Category" category
      WHERE category.id = "CategoryRequiredDocument"."categoryId"
        AND public.same_company(category."companyId")
    )
  );

CREATE POLICY conformix_supplier_all ON public."Supplier"
  FOR ALL TO authenticated
  USING (public.same_company("companyId"))
  WITH CHECK (public.same_company("companyId"));

CREATE POLICY conformix_evaluation_all ON public."Evaluation"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Supplier" supplier
      WHERE supplier.id = "Evaluation"."supplierId"
        AND public.same_company(supplier."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Supplier" supplier
      WHERE supplier.id = "Evaluation"."supplierId"
        AND public.same_company(supplier."companyId")
    )
  );

CREATE POLICY conformix_evaluation_answer_all ON public."EvaluationAnswer"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Evaluation" evaluation
      JOIN public."Supplier" supplier ON supplier.id = evaluation."supplierId"
      WHERE evaluation.id = "EvaluationAnswer"."evaluationId"
        AND public.same_company(supplier."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Evaluation" evaluation
      JOIN public."Supplier" supplier ON supplier.id = evaluation."supplierId"
      WHERE evaluation.id = "EvaluationAnswer"."evaluationId"
        AND public.same_company(supplier."companyId")
    )
  );

CREATE POLICY conformix_rnc_all ON public."RNC"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Supplier" supplier
      WHERE supplier.id = "RNC"."supplierId"
        AND public.same_company(supplier."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Supplier" supplier
      WHERE supplier.id = "RNC"."supplierId"
        AND public.same_company(supplier."companyId")
    )
  );

CREATE POLICY conformix_supplier_document_all ON public."SupplierDocument"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Supplier" supplier
      WHERE supplier.id = "SupplierDocument"."supplierId"
        AND public.same_company(supplier."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Supplier" supplier
      WHERE supplier.id = "SupplierDocument"."supplierId"
        AND public.same_company(supplier."companyId")
    )
  );

CREATE POLICY conformix_audit_log_all ON public."AuditLog"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."User" target_user
      WHERE target_user.id = "AuditLog"."userId"
        AND public.same_company(target_user."companyId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."User" target_user
      WHERE target_user.id = "AuditLog"."userId"
        AND public.same_company(target_user."companyId")
    )
  );

CREATE POLICY conformix_alert_all ON public."Alert"
  FOR ALL TO authenticated
  USING (public.same_company("companyId"))
  WITH CHECK (public.same_company("companyId"));
