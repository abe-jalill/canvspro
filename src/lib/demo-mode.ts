// Localhost-only demo student, used to capture the homepage screenshots.
//
// Visit any signed-in page on the dev server with `?demo=1` (and optionally
// `&theme=light|dark`). A made-up student's session is stored and every
// backend request is answered with sample data, so no real account or real
// Canvas data is ever shown. `?demo=0` turns it off. Production builds never
// run this: the call below is behind `import.meta.env.DEV`.

const FLAG = "cp-demo";
const DEMO_USER_ID = "00000000-0000-4000-8000-00000000d3e0";
const PROJECT_REF = "vqmzhzvugzhmtprklzfm";

function at(days: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const COURSES = [
  {
    id: 9101,
    name: "Cell Biology",
    course_code: "BIO 201",
    current_score: 93.4,
    current_grade: "A",
  },
  {
    id: 9102,
    name: "Introduction to Psychology",
    course_code: "PSY 101",
    current_score: 88.1,
    current_grade: "B+",
  },
  {
    id: 9103,
    name: "General Chemistry",
    course_code: "CHEM 110",
    current_score: 81.6,
    current_grade: "B-",
  },
  {
    id: 9104,
    name: "College Writing",
    course_code: "ENG 102",
    current_score: 95.2,
    current_grade: "A",
  },
  {
    id: 9105,
    name: "Calculus I",
    course_code: "MATH 151",
    current_score: 90.3,
    current_grade: "A-",
  },
].map((course) => ({ ...course, final_score: course.current_score, syllabus_body: null }));

type DemoAssignment = [
  id: number,
  course: number,
  name: string,
  due: string,
  points: number,
  graded?: number,
];

function assignments() {
  const rows: DemoAssignment[] = [
    // Graded work from the last two weeks.
    [8001, 9101, "Lab 3: Microscopy", at(-6, 23, 59), 50, 47],
    [8002, 9102, "Chapter 4 Quiz", at(-4, 11, 0), 20, 18],
    [8003, 9104, "Personal Narrative Draft", at(-8, 23, 59), 100, 95],
    [8004, 9103, "Problem Set 3", at(-5, 23, 59), 50, 40],
    [8005, 9105, "Quiz 2: Limits", at(-3, 10, 0), 30, 27],
    // One item to catch up on.
    [8006, 9103, "Lab Report 2", at(-1, 18, 0), 40],
    // The weeks ahead.
    [8007, 9105, "WebAssign 3.4: Derivatives", at(0, 23, 59), 20],
    [8008, 9102, "Reading Response 5", at(0, 23, 59), 10],
    [8009, 9101, "Lab 4: Osmosis Prelab", at(1, 11, 59), 15],
    [8010, 9104, "Annotated Bibliography", at(2, 23, 59), 50],
    [8011, 9103, "Quiz 4: Stoichiometry", at(2, 9, 0), 25],
    [8012, 9105, "Problem Set 4", at(3, 23, 59), 40],
    [8013, 9102, "Research Methods Worksheet", at(4, 17, 0), 30],
    [8014, 9101, "Cell Signaling Case Study", at(5, 23, 59), 60],
    [8015, 9103, "Problem Set 5", at(6, 14, 0), 50],
    [8016, 9104, "Argument Essay Outline", at(8, 23, 59), 40],
    [8017, 9105, "Midterm Review Packet", at(9, 23, 59), 25],
    [8018, 9101, "Midterm Exam", at(12, 9, 30), 100],
    [8019, 9102, "Chapter 6 Quiz", at(13, 11, 0), 20],
  ];
  return rows.map(([id, courseId, name, due, points, score]) => {
    const course = COURSES.find((item) => item.id === courseId)!;
    return {
      id,
      name,
      description: `<p>${name} for ${course.name}.</p>`,
      due_at: due,
      html_url: `https://demo.instructure.com/courses/${courseId}/assignments/${id}`,
      points_possible: points,
      course_id: courseId,
      course_name: course.name,
      course_code: course.course_code,
      submission:
        score == null
          ? { workflow_state: "unsubmitted", submitted_at: null, score: null }
          : {
              workflow_state: "graded",
              submitted_at: due,
              score,
              graded_at: due,
              grade: String(score),
            },
    };
  });
}

function announcements() {
  return [
    [
      7001,
      9101,
      "Lab 4 moved to Thursday",
      "The osmosis lab will run Thursday this week.",
      at(-1, 9, 15),
    ],
    [
      7002,
      9104,
      "Peer review partners posted",
      "Check the Discussions page for your partner.",
      at(-2, 14, 0),
    ],
    [
      7003,
      9105,
      "Office hours this week",
      "Extra office hours Wednesday 3-5 PM before Problem Set 4.",
      at(0, 8, 30),
    ],
  ].map(([id, courseId, title, message, posted]) => {
    const course = COURSES.find((item) => item.id === courseId)!;
    return {
      id,
      title,
      message: `<p>${message}</p>`,
      posted_at: posted,
      html_url: `https://demo.instructure.com/courses/${courseId}/discussion_topics/${id}`,
      context_code: `course_${courseId}`,
      course_id: courseId,
      course_name: course.name,
      course_code: course.course_code,
    };
  });
}

function calendar() {
  return [
    {
      id: "e1",
      title: "BIO 201 Study Group",
      start_at: at(1, 18, 0),
      end_at: at(1, 19, 30),
      context_name: "Cell Biology",
      context_code: "course_9101",
      location_name: "Library 204",
    },
    {
      id: "e2",
      title: "Calculus Office Hours",
      start_at: at(2, 15, 0),
      end_at: at(2, 17, 0),
      context_name: "Calculus I",
      context_code: "course_9105",
      location_name: "Math 112",
    },
    {
      id: "e3",
      title: "Midterm Exam",
      start_at: at(12, 9, 30),
      end_at: at(12, 11, 0),
      context_name: "Cell Biology",
      context_code: "course_9101",
      location_name: "Science Hall 101",
    },
  ];
}

const USER = {
  id: DEMO_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "maya.chen@example.edu",
  email_confirmed_at: "2026-08-20T12:00:00.000Z",
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { first_name: "Maya", last_name: "Chen", username: "maya", nickname: "Maya" },
  identities: [],
  created_at: "2026-08-20T12:00:00.000Z",
  updated_at: "2026-08-20T12:00:00.000Z",
};

function session() {
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  return {
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    expires_in: 365 * 24 * 3600,
    expires_at: expiresAt,
    user: USER,
  };
}

/** Rows for the account's own tables. Anything not listed is empty. */
function tableRows(table: string): unknown[] {
  switch (table) {
    case "user_settings":
      return [
        {
          user_id: DEMO_USER_ID,
          canvas_domain: "demo.instructure.com",
          created_at: USER.created_at,
        },
      ];
    case "account_profiles":
    case "profiles":
      return [
        {
          user_id: DEMO_USER_ID,
          id: DEMO_USER_ID,
          username: "maya",
          first_name: "Maya",
          last_name: "Chen",
          nickname: "Maya",
          avatar_path: null,
          school: "State University",
          major: "Biology",
          class_year: "2028",
        },
      ];
    case "user_assignment_meta":
      return [
        {
          user_id: DEMO_USER_ID,
          assignment_id: 8010,
          course_id: 9104,
          estimated_minutes: 90,
          progress_percent: 75,
        },
        {
          user_id: DEMO_USER_ID,
          assignment_id: 8014,
          course_id: 9101,
          estimated_minutes: 120,
          progress_percent: 40,
        },
        {
          user_id: DEMO_USER_ID,
          assignment_id: 8012,
          course_id: 9105,
          estimated_minutes: 60,
          progress_percent: null,
        },
      ];
    case "class_nicknames":
      return COURSES.map((course) => ({
        user_id: DEMO_USER_ID,
        canvas_course_id: course.id,
        raw_name: course.name,
        raw_code: course.course_code,
        custom_name: course.name,
      }));
    case "user_preferences":
      return [
        {
          user_id: DEMO_USER_ID,
          key: "theme",
          value: sessionStorage.getItem(`${FLAG}-theme`) ?? "system",
        },
        { user_id: DEMO_USER_ID, key: "color_theme", value: "forest" },
      ];
    default:
      return [];
  }
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

async function bodyOf(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  try {
    if (init?.body && typeof init.body === "string") return JSON.parse(init.body);
    if (input instanceof Request) return await input.clone().json();
  } catch {
    /* no body */
  }
  return {};
}

function answer(
  url: URL,
  method: string,
  headers: Headers,
  body: Record<string, unknown>,
): Response | null {
  const path = url.pathname;
  if (path.startsWith("/auth/v1/user")) return json(USER);
  if (path.startsWith("/auth/v1/token")) return json(session());
  if (path.startsWith("/auth/v1/logout")) return new Response(null, { status: 204 });
  if (path.startsWith("/auth/v1/")) return json({});
  if (path === "/functions/v1/canvas") {
    const bundle = {
      courses: COURSES,
      assignments: assignments(),
      announcements: announcements(),
      calendar: calendar(),
    };
    const resource = String(body.resource ?? "all");
    if (resource === "all") return json(bundle);
    if (resource in bundle) return json(bundle[resource as keyof typeof bundle]);
    return json(bundle.assignments);
  }
  if (path.startsWith("/functions/v1/subscription-access")) {
    return json({ active: true, plan: "pro", status: "active" });
  }
  if (path.startsWith("/functions/v1/")) return json({});
  if (path.startsWith("/rest/v1/rpc/")) {
    const name = path.slice("/rest/v1/rpc/".length);
    return json(name === "has_canvas_key" ? true : null);
  }
  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length).split("/")[0];
    if (method !== "GET" && method !== "HEAD") return json([], 201);
    const rows = tableRows(table);
    const wantsObject = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
    if (wantsObject) {
      return rows.length > 0
        ? json(rows[0])
        : json({ code: "PGRST116", message: "No rows", details: null, hint: null }, 406);
    }
    return json(rows, 200, { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
  }
  if (path.startsWith("/storage/v1/")) return json({ message: "Not found" }, 404);
  return null;
}

function installDemoMode() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "0") {
    sessionStorage.removeItem(FLAG);
    localStorage.removeItem(`sb-${PROJECT_REF}-auth-token`);
    return;
  }
  if (params.get("demo") === "1") sessionStorage.setItem(FLAG, "1");
  if (sessionStorage.getItem(FLAG) !== "1") return;

  // `studyMode=total|per|pomodoro` sets the Study session time choice for a capture.
  const studyMode = params.get("studyMode");
  if (studyMode === "total" || studyMode === "per" || studyMode === "pomodoro") {
    localStorage.setItem("canvas:study-time-mode", studyMode);
  }
  // `neutral=1` shows the app's neutral charcoal look (no color theme, plain
  // background) so homepage screenshots sit quietly on a monochrome page.
  if (params.get("neutral") === "1") {
    const root = document.documentElement;
    const strip = () => {
      if (root.hasAttribute("data-palette")) root.removeAttribute("data-palette");
      if (root.dataset.wallpaper !== "plain") root.dataset.wallpaper = "plain";
    };
    new MutationObserver(strip).observe(root, {
      attributes: true,
      attributeFilter: ["data-palette", "data-wallpaper"],
    });
    strip();
    // The dashboard greeting card falls back to green without a theme.
    root.style.setProperty("--palette-saturation", "0%");
  }
  const theme = params.get("theme");
  if (theme === "light" || theme === "dark") {
    sessionStorage.setItem(`${FLAG}-theme`, theme);
    localStorage.setItem("canvas:theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }
  localStorage.setItem(`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session()));

  const backend = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (backend && raw.startsWith(backend)) {
      const url = new URL(raw);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      const response = answer(url, method, headers, await bodyOf(input, init));
      if (response) return response;
    }
    return realFetch(input, init);
  };
}

if (import.meta.env.DEV) installDemoMode();

export {};
