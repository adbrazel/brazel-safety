// Supabase Client Configuration (safe/idempotent)
// - Avoids "Identifier 'supabase' has already been declared" crashes.
// - Provides DB helpers with column mapping to match your Supabase tables.

(function () {
  if (window.__brazelSupabaseClientLoaded) return;
  window.__brazelSupabaseClientLoaded = true;

  // NOTE: keep these as var to avoid redeclare crashes if file is loaded twice.
  var SUPABASE_URL = "https://quhcdcpzujgkjoyszlnu.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_8TlrdPkx4_jb9K0ZQKuDJw_QGioNLSh";

  var _client = null;

  function ensureSupabaseLoaded() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && typeof window.supabase.createClient === "function") return resolve();

      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Failed to load Supabase library")); };
      document.head.appendChild(script);
    });
  }

  // ---- Mapping helpers ----
  function mapJobToDb(job) {
    return {
      name: job.name,
      address: job.address || "",
      address2: job.address2 || "",
      emergency_phone: job.emergency_phone ?? job.emergencyPhone ?? ""
    };
  }
  function mapJobFromDb(row) {
    return Object.assign({}, row, {
      emergencyPhone: row.emergencyPhone ?? row.emergency_phone ?? ""
    });
  }

  function mapHazardToDb(h) {
    return {
      name: h.name,
      risk: h.risk || "",
      severity: h.severity || "",
      suggested_controls: h.suggested_controls ?? h.suggestedControls ?? ""
    };
  }
  function mapHazardFromDb(row) {
    return Object.assign({}, row, {
      suggestedControls: row.suggestedControls ?? row.suggested_controls ?? ""
    });
  }

  function mapTopicToDb(topic) {
    return {
      name: topic.name,
      sort_order: (topic.sort_order ?? topic.sortOrder ?? 0),
      active: (topic.active ?? true)
    };
  }
  function mapTopicFromDb(row) {
    return Object.assign({}, row, {
      sortOrder: row.sortOrder ?? row.sort_order ?? 0
    });
  }

  function mapResourceToDb(r) {
    return {
      name: r.name,
      category: r.category || "",
      file_path: r.file_path ?? r.filePath ?? "",
      file_url: r.file_url ?? r.fileUrl ?? "",
      file_size: r.file_size ?? r.fileSize ?? null
      // uploaded_at handled by DB default if configured
    };
  }
  function mapResourceFromDb(row) {
    return Object.assign({}, row, {
      filePath: row.filePath ?? row.file_path ?? "",
      fileUrl: row.fileUrl ?? row.file_url ?? "",
      fileSize: row.fileSize ?? row.file_size ?? null
    });
  }

  function buildDb(client) {
    return {
      // Jobs
      async getJobs() {
        const { data, error } = await client.from("jobs").select("*").order("name");
        if (error) throw error;
        return (data || []).map(mapJobFromDb);
      },
      async addJob(job) {
        const payload = mapJobToDb(job);
        const { data, error } = await client.from("jobs").insert([payload]).select().single();
        if (error) throw error;
        return mapJobFromDb(data);
      },
      async updateJob(id, updates) {
        const payload = mapJobToDb(updates);
        const { data, error } = await client.from("jobs").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return mapJobFromDb(data);
      },
      async deleteJob(id) {
        const { error } = await client.from("jobs").delete().eq("id", id);
        if (error) throw error;
      },

      // Hazards
      async getHazards() {
        const { data, error } = await client.from("hazards").select("*").order("name");
        if (error) throw error;
        return (data || []).map(mapHazardFromDb);
      },
      async addHazard(hazard) {
        const payload = mapHazardToDb(hazard);
        const { data, error } = await client.from("hazards").insert([payload]).select().single();
        if (error) throw error;
        return mapHazardFromDb(data);
      },
      async updateHazard(id, updates) {
        const payload = mapHazardToDb(updates);
        const { data, error } = await client.from("hazards").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return mapHazardFromDb(data);
      },
      async deleteHazard(id) {
        const { error } = await client.from("hazards").delete().eq("id", id);
        if (error) throw error;
      },

      // Safety Topics
      async getSafetyTopics() {
        const { data, error } = await client.from("safety_topics").select("*").eq("active", true).order("sort_order");
        if (error) throw error;
        return (data || []).map(mapTopicFromDb);
      },
      async addSafetyTopic(topic) {
        const payload = mapTopicToDb(topic);
        const { data, error } = await client.from("safety_topics").insert([payload]).select().single();
        if (error) throw error;
        return mapTopicFromDb(data);
      },
      async updateSafetyTopic(id, updates) {
        const payload = mapTopicToDb(updates);
        const { data, error } = await client.from("safety_topics").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return mapTopicFromDb(data);
      },
      async deleteSafetyTopic(id) {
        const { error } = await client.from("safety_topics").delete().eq("id", id);
        if (error) throw error;
      },

      // Resources
      async getResources() {
        const { data, error } = await client.from("resources").select("*").order("uploaded_at", { ascending: false });
        if (error) throw error;
        return (data || []).map(mapResourceFromDb);
      },
      async addResource(resource) {
        const payload = mapResourceToDb(resource);
        const { data, error } = await client.from("resources").insert([payload]).select().single();
        if (error) throw error;
        return mapResourceFromDb(data);
      },
      async deleteResource(id) {
        const { error } = await client.from("resources").delete().eq("id", id);
        if (error) throw error;
      },

      // Forms (kept generic)
      async addForm(form) {
        const { data, error } = await client.from("forms").insert([form]).select().single();
        if (error) throw error;
        return data;
      },

      // Safer insert that matches the recommended 'forms' schema (with jsonb 'data')
      async addFormMapped(formData) {
        const payload = {
          job_name: formData.jobName || formData.job_name || null,
          date: formData.date || null,
          supervisor_name: formData.supervisorName || formData.supervisor_name || null,
          pdf_url: formData.pdfUrl || formData.pdf_url || null,
          email_sent: !!formData.emailSent,
          // Full payload for auditing
          data: formData
        };
        const { data, error } = await client.from("forms").insert([payload]).select().single();
        if (error) throw error;
        return data;
      },

      // Storage upload helper
      async uploadFile(bucket, path, file) {
        const { data, error } = await client.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
        return {
          path: (data && data.path) ? data.path : path,
          fullPath: (data && data.fullPath) ? data.fullPath : path,
          publicUrl: urlData ? urlData.publicUrl : null
        };
      }
    };
  }

  window.initSupabase = async function initSupabase() {
    try {
      await ensureSupabaseLoaded();
      _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabaseClient = _client;
      window.db = buildDb(_client);
      console.log("✅ Supabase client initialized");
      return true;
    } catch (err) {
      console.error("❌ Supabase initialization error:", err);
      return false;
    }
  };
})();
