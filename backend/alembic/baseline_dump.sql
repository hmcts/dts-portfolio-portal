--
-- PostgreSQL database dump
--

\restrict nzqS62gej3yh12kHu7YBH5nip86PC9mzyh4nudj15XbV9kJdCFfaAXsfhn6Hhkd

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10 (Homebrew)

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
-- Name: EntityKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EntityKind" AS ENUM (
    'jurisdiction',
    'domain',
    'team',
    'product'
);


--
-- Name: ProductStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductStage" AS ENUM (
    'discovery',
    'alpha',
    'beta',
    'live',
    'retiring',
    'retired'
);


--
-- Name: TimeBucket; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TimeBucket" AS ENUM (
    'NOW',
    'NEXT',
    'LATER'
);


--
-- Name: reject_ai_parse_metric_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_ai_parse_metric_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'AiParseMetric is append-only; % is not permitted', TG_OP;
END;
$$;


--
-- Name: reject_search_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_search_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'SearchEvent is append-only; % is not permitted', TG_OP;
END;
$$;


--
-- Name: submission_immutability_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submission_immutability_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (
       NEW."entityKind"        IS DISTINCT FROM OLD."entityKind"
    OR NEW."submitter"         IS DISTINCT FROM OLD."submitter"
    OR NEW."submittedAt"       IS DISTINCT FROM OLD."submittedAt"
    OR NEW."sourceMarkdown"    IS DISTINCT FROM OLD."sourceMarkdown"
    OR NEW."sourceMarkdownSha" IS DISTINCT FROM OLD."sourceMarkdownSha"
  ) THEN
    RAISE EXCEPTION 'Submission row is append-only; only approver, approvedAt, versionNumber, notes, aiParsedOutput, aiConfidenceFlags, and entityId may be updated.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: submission_no_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submission_no_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Submission rows cannot be deleted (append-only audit log).'
    USING ERRCODE = 'check_violation';
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AiParseMetric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiParseMetric" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source text NOT NULL,
    model text,
    outcome text NOT NULL,
    "promptTokens" integer,
    "completionTokens" integer,
    "totalTokens" integer,
    "latencyMs" integer NOT NULL,
    "failureReason" text,
    "submissionId" text
);


--
-- Name: Initiative; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Initiative" (
    id text NOT NULL,
    "productId" text NOT NULL,
    bucket public."TimeBucket" NOT NULL,
    title text NOT NULL,
    description text,
    "outboundUrl" text,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED
);


--
-- Name: Jurisdiction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Jurisdiction" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED
);


--
-- Name: OutboundLink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OutboundLink" (
    id text NOT NULL,
    "productId" text NOT NULL,
    label text NOT NULL,
    url text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    stage public."ProductStage" DEFAULT 'discovery'::public."ProductStage" NOT NULL,
    "domainId" text NOT NULL,
    "operatingTeamId" text NOT NULL,
    "lastApprovedAt" timestamp(3) without time zone,
    "lastApprovedBy" text,
    "versionNumber" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char"))) STORED
);


--
-- Name: ProductDomain; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProductDomain" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    "jurisdictionId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED
);


--
-- Name: SearchEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SearchEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    kind text NOT NULL,
    query text NOT NULL,
    "resultCount" integer,
    "clickedEntityType" text,
    "clickedEntityId" text,
    "clickedPosition" integer,
    "subjectHash" text
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    "entityKind" public."EntityKind" NOT NULL,
    "entityId" text,
    submitter text NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sourceMarkdown" bytea NOT NULL,
    "sourceMarkdownSha" text NOT NULL,
    "aiParsedOutput" jsonb,
    "aiConfidenceFlags" jsonb,
    approver text,
    "approvedAt" timestamp(3) without time zone,
    "versionNumber" integer,
    notes text,
    "aiParseSource" text
);


--
-- Name: Team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    contact text,
    "domainId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "searchTsv" tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(contact, ''::text)), 'D'::"char"))) STORED
);


--
-- Name: Theme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Theme" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "domainId" text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _ConsumedByJurisdiction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_ConsumedByJurisdiction" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AiParseMetric AiParseMetric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiParseMetric"
    ADD CONSTRAINT "AiParseMetric_pkey" PRIMARY KEY (id);


--
-- Name: Initiative Initiative_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Initiative"
    ADD CONSTRAINT "Initiative_pkey" PRIMARY KEY (id);


--
-- Name: Jurisdiction Jurisdiction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Jurisdiction"
    ADD CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY (id);


--
-- Name: OutboundLink OutboundLink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundLink"
    ADD CONSTRAINT "OutboundLink_pkey" PRIMARY KEY (id);


--
-- Name: ProductDomain ProductDomain_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductDomain"
    ADD CONSTRAINT "ProductDomain_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: SearchEvent SearchEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SearchEvent"
    ADD CONSTRAINT "SearchEvent_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: Theme Theme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Theme"
    ADD CONSTRAINT "Theme_pkey" PRIMARY KEY (id);


--
-- Name: _ConsumedByJurisdiction _ConsumedByJurisdiction_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ConsumedByJurisdiction"
    ADD CONSTRAINT "_ConsumedByJurisdiction_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AiParseMetric_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiParseMetric_createdAt_idx" ON public."AiParseMetric" USING btree ("createdAt");


--
-- Name: AiParseMetric_source_outcome_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiParseMetric_source_outcome_idx" ON public."AiParseMetric" USING btree (source, outcome);


--
-- Name: Initiative_productId_bucket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Initiative_productId_bucket_idx" ON public."Initiative" USING btree ("productId", bucket);


--
-- Name: Initiative_searchTsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Initiative_searchTsv_idx" ON public."Initiative" USING gin ("searchTsv");


--
-- Name: Jurisdiction_searchTsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Jurisdiction_searchTsv_idx" ON public."Jurisdiction" USING gin ("searchTsv");


--
-- Name: Jurisdiction_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Jurisdiction_slug_key" ON public."Jurisdiction" USING btree (slug);


--
-- Name: OutboundLink_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundLink_productId_idx" ON public."OutboundLink" USING btree ("productId");


--
-- Name: ProductDomain_jurisdictionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductDomain_jurisdictionId_idx" ON public."ProductDomain" USING btree ("jurisdictionId");


--
-- Name: ProductDomain_searchTsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProductDomain_searchTsv_idx" ON public."ProductDomain" USING gin ("searchTsv");


--
-- Name: ProductDomain_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProductDomain_slug_key" ON public."ProductDomain" USING btree (slug);


--
-- Name: Product_domainId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_domainId_idx" ON public."Product" USING btree ("domainId");


--
-- Name: Product_operatingTeamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_operatingTeamId_idx" ON public."Product" USING btree ("operatingTeamId");


--
-- Name: Product_searchTsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_searchTsv_idx" ON public."Product" USING gin ("searchTsv");


--
-- Name: Product_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_slug_key" ON public."Product" USING btree (slug);


--
-- Name: SearchEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SearchEvent_createdAt_idx" ON public."SearchEvent" USING btree ("createdAt");


--
-- Name: SearchEvent_kind_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SearchEvent_kind_createdAt_idx" ON public."SearchEvent" USING btree (kind, "createdAt");


--
-- Name: SearchEvent_query_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SearchEvent_query_idx" ON public."SearchEvent" USING btree (query);


--
-- Name: Submission_entityKind_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_entityKind_entityId_idx" ON public."Submission" USING btree ("entityKind", "entityId");


--
-- Name: Submission_sourceMarkdownSha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_sourceMarkdownSha_idx" ON public."Submission" USING btree ("sourceMarkdownSha");


--
-- Name: Team_domainId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Team_domainId_idx" ON public."Team" USING btree ("domainId");


--
-- Name: Team_searchTsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Team_searchTsv_idx" ON public."Team" USING gin ("searchTsv");


--
-- Name: Team_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Team_slug_key" ON public."Team" USING btree (slug);


--
-- Name: Theme_domainId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Theme_domainId_idx" ON public."Theme" USING btree ("domainId");


--
-- Name: _ConsumedByJurisdiction_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_ConsumedByJurisdiction_B_index" ON public."_ConsumedByJurisdiction" USING btree ("B");


--
-- Name: AiParseMetric ai_parse_metric_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_parse_metric_no_delete BEFORE DELETE ON public."AiParseMetric" FOR EACH ROW EXECUTE FUNCTION public.reject_ai_parse_metric_mutation();


--
-- Name: AiParseMetric ai_parse_metric_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_parse_metric_no_update BEFORE UPDATE ON public."AiParseMetric" FOR EACH ROW EXECUTE FUNCTION public.reject_ai_parse_metric_mutation();


--
-- Name: SearchEvent search_event_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_event_no_delete BEFORE DELETE ON public."SearchEvent" FOR EACH ROW EXECUTE FUNCTION public.reject_search_event_mutation();


--
-- Name: SearchEvent search_event_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER search_event_no_update BEFORE UPDATE ON public."SearchEvent" FOR EACH ROW EXECUTE FUNCTION public.reject_search_event_mutation();


--
-- Name: Submission submission_immutability_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER submission_immutability_check BEFORE UPDATE ON public."Submission" FOR EACH ROW EXECUTE FUNCTION public.submission_immutability_guard();


--
-- Name: Submission submission_no_delete_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER submission_no_delete_check BEFORE DELETE ON public."Submission" FOR EACH ROW EXECUTE FUNCTION public.submission_no_delete();


--
-- Name: Initiative Initiative_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Initiative"
    ADD CONSTRAINT "Initiative_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OutboundLink OutboundLink_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundLink"
    ADD CONSTRAINT "OutboundLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProductDomain ProductDomain_jurisdictionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProductDomain"
    ADD CONSTRAINT "ProductDomain_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES public."Jurisdiction"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_domainId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES public."ProductDomain"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_operatingTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_operatingTeamId_fkey" FOREIGN KEY ("operatingTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Team Team_domainId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES public."ProductDomain"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Theme Theme_domainId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Theme"
    ADD CONSTRAINT "Theme_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES public."ProductDomain"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: _ConsumedByJurisdiction _ConsumedByJurisdiction_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ConsumedByJurisdiction"
    ADD CONSTRAINT "_ConsumedByJurisdiction_A_fkey" FOREIGN KEY ("A") REFERENCES public."Jurisdiction"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _ConsumedByJurisdiction _ConsumedByJurisdiction_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ConsumedByJurisdiction"
    ADD CONSTRAINT "_ConsumedByJurisdiction_B_fkey" FOREIGN KEY ("B") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict nzqS62gej3yh12kHu7YBH5nip86PC9mzyh4nudj15XbV9kJdCFfaAXsfhn6Hhkd

