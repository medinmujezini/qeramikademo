CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_materials_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_materials_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    entity_name text,
    changes_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: column_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.column_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    shape text DEFAULT 'rectangle'::text NOT NULL,
    default_dimensions_json jsonb DEFAULT '{"depth": 30, "width": 30, "height": 280}'::jsonb NOT NULL,
    is_structural boolean DEFAULT true NOT NULL,
    default_material text DEFAULT 'concrete'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fixture_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    dimensions_json jsonb DEFAULT '{"depth": 60, "width": 60, "height": 80}'::jsonb NOT NULL,
    clearance_json jsonb DEFAULT '{"rear": 0, "front": 60, "sides": 15}'::jsonb NOT NULL,
    requires_wall boolean DEFAULT false NOT NULL,
    wall_offset integer DEFAULT 0 NOT NULL,
    trap_height integer,
    supply_height integer,
    wattage integer,
    connection_templates_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    dfu_value integer DEFAULT 1 NOT NULL,
    gpm_cold numeric(5,2) DEFAULT 1.0 NOT NULL,
    gpm_hot numeric(5,2) DEFAULT 0.0 NOT NULL,
    icon text DEFAULT 'droplet'::text NOT NULL,
    model_url text,
    thumbnail_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: furniture_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.furniture_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    dimensions_json jsonb DEFAULT '{"depth": 100, "width": 100, "height": 100}'::jsonb NOT NULL,
    default_color text DEFAULT '#8B4513'::text NOT NULL,
    icon text DEFAULT 'box'::text NOT NULL,
    model_url text,
    thumbnail_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grout_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grout_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    hex_color text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    albedo_url text,
    normal_url text,
    roughness_url text,
    metallic_url text,
    ao_url text,
    arm_url text,
    height_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    floor_plan_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tile_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tile_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    material text DEFAULT 'ceramic'::text NOT NULL,
    dimensions_json jsonb DEFAULT '{"width": 30, "height": 30}'::jsonb NOT NULL,
    price_per_unit numeric(10,2) DEFAULT 0.00 NOT NULL,
    default_color text DEFAULT '#FFFFFF'::text NOT NULL,
    min_curve_radius integer,
    is_flexible boolean DEFAULT false NOT NULL,
    thumbnail_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: column_templates column_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_templates
    ADD CONSTRAINT column_templates_pkey PRIMARY KEY (id);


--
-- Name: fixture_templates fixture_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_templates
    ADD CONSTRAINT fixture_templates_pkey PRIMARY KEY (id);


--
-- Name: fixture_templates fixture_templates_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_templates
    ADD CONSTRAINT fixture_templates_type_key UNIQUE (type);


--
-- Name: furniture_templates furniture_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furniture_templates
    ADD CONSTRAINT furniture_templates_pkey PRIMARY KEY (id);


--
-- Name: furniture_templates furniture_templates_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.furniture_templates
    ADD CONSTRAINT furniture_templates_type_key UNIQUE (type);


--
-- Name: grout_colors grout_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grout_colors
    ADD CONSTRAINT grout_colors_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: tile_templates tile_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tile_templates
    ADD CONSTRAINT tile_templates_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: column_templates update_column_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_column_templates_updated_at BEFORE UPDATE ON public.column_templates FOR EACH ROW EXECUTE FUNCTION public.update_materials_updated_at();


--
-- Name: fixture_templates update_fixture_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fixture_templates_updated_at BEFORE UPDATE ON public.fixture_templates FOR EACH ROW EXECUTE FUNCTION public.update_materials_updated_at();


--
-- Name: furniture_templates update_furniture_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_furniture_templates_updated_at BEFORE UPDATE ON public.furniture_templates FOR EACH ROW EXECUTE FUNCTION public.update_materials_updated_at();


--
-- Name: materials update_materials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_materials_updated_at();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_materials_updated_at();


--
-- Name: tile_templates update_tile_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tile_templates_updated_at BEFORE UPDATE ON public.tile_templates FOR EACH ROW EXECUTE FUNCTION public.update_materials_updated_at();


--
-- Name: admin_activity_log admin_activity_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_activity_log Admins can insert activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert activity log" ON public.admin_activity_log FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: column_templates Admins can manage column templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage column templates" ON public.column_templates USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: fixture_templates Admins can manage fixture templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage fixture templates" ON public.fixture_templates USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: furniture_templates Admins can manage furniture templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage furniture templates" ON public.furniture_templates USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: grout_colors Admins can manage grout colors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage grout colors" ON public.grout_colors USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tile_templates Admins can manage tile templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tile templates" ON public.tile_templates USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_activity_log Admins can view activity log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view activity log" ON public.admin_activity_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: materials Anyone can create materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create materials" ON public.materials FOR INSERT WITH CHECK (true);


--
-- Name: materials Anyone can delete materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete materials" ON public.materials FOR DELETE USING (true);


--
-- Name: materials Anyone can update materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update materials" ON public.materials FOR UPDATE USING (true);


--
-- Name: column_templates Column templates are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Column templates are publicly readable" ON public.column_templates FOR SELECT USING (true);


--
-- Name: fixture_templates Fixture templates are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Fixture templates are publicly readable" ON public.fixture_templates FOR SELECT USING (true);


--
-- Name: furniture_templates Furniture templates are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Furniture templates are publicly readable" ON public.furniture_templates FOR SELECT USING (true);


--
-- Name: grout_colors Grout colors are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Grout colors are publicly readable" ON public.grout_colors FOR SELECT USING (true);


--
-- Name: materials Materials are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Materials are publicly readable" ON public.materials FOR SELECT USING (true);


--
-- Name: tile_templates Tile templates are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tile templates are publicly readable" ON public.tile_templates FOR SELECT USING (true);


--
-- Name: projects Users can create their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: projects Users can delete their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: projects Users can update their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: projects Users can view their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: column_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.column_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: fixture_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixture_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: furniture_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.furniture_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: grout_colors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grout_colors ENABLE ROW LEVEL SECURITY;

--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: tile_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tile_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;