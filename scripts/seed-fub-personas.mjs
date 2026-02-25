#!/usr/bin/env node

import "dotenv/config";

const API_BASE_URL = process.env.FUB_API_BASE_URL || "https://api.followupboss.com/v1";
const FUB_API_KEY = process.env.FUB_API_KEY;
const X_SYSTEM = process.env.FOLLOW_UP_BOSS_X_SYSTEM;
const X_SYSTEM_KEY = process.env.FOLLOW_UP_BOSS_X_SYSTEM_KEY;

if (!FUB_API_KEY || !X_SYSTEM || !X_SYSTEM_KEY) {
  console.error(
    "Missing required env vars. Expected: FUB_API_KEY, FOLLOW_UP_BOSS_X_SYSTEM, FOLLOW_UP_BOSS_X_SYSTEM_KEY",
  );
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(`${FUB_API_KEY}:`).toString("base64")}`;
const runTag = `persona-seed-${new Date().toISOString().slice(0, 10)}`;

function parseBatchArg() {
  const batchArg = process.argv.find((arg) => arg.startsWith("--batch="));
  if (!batchArg) return 1;
  const parsed = Number(batchArg.split("=")[1]);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

const batch = parseBatchArg();
const batchTag = `persona-batch-${batch}`;

const personaBatches = {
  1: [
    {
      firstName: "Maya",
      lastName: "Rivers",
      archetype: "First-Time Urban Condo Buyer",
      archetypeTag: "first-time-buyer",
      phone: "202-555-0101",
      city: "Denver",
      state: "CO",
      budget: 525000,
      note: "Wants a walkable neighborhood, low HOA, and strong resale potential.",
    },
    {
      firstName: "Derrick",
      lastName: "Coleman",
      archetype: "Move-Up Suburban Family",
      archetypeTag: "move-up-family",
      phone: "202-555-0102",
      city: "Centennial",
      state: "CO",
      budget: 875000,
      note: "Prioritizes school district, yard size, and commute under 35 minutes.",
    },
    {
      firstName: "Elena",
      lastName: "Park",
      archetype: "Luxury Relocation Executive",
      archetypeTag: "luxury-relocation",
      phone: "202-555-0103",
      city: "Cherry Hills Village",
      state: "CO",
      budget: 2400000,
      note: "Relocating for work, needs discreet off-market options and turnkey condition.",
    },
    {
      firstName: "Howard",
      lastName: "Nash",
      archetype: "Downsizing Empty-Nester Seller",
      archetypeTag: "downsizing-seller",
      phone: "202-555-0104",
      city: "Littleton",
      state: "CO",
      budget: 780000,
      note: "Selling larger home and wants condo living near healthcare and dining.",
    },
    {
      firstName: "Priya",
      lastName: "Malhotra",
      archetype: "Cash-Flow Focused Investor",
      archetypeTag: "investor",
      phone: "202-555-0105",
      city: "Aurora",
      state: "CO",
      budget: 980000,
      note: "Analyzes rent comps, cap rate, and renovation timeline before writing offers.",
    },
  ],
  2: [
    {
      firstName: "Noah",
      lastName: "Bennett",
      archetype: "Military VA Relocation Buyer",
      archetypeTag: "military-relocation",
      phone: "202-555-0111",
      city: "Colorado Springs",
      state: "CO",
      budget: 610000,
      note: "Needs VA-eligible properties close to base and strong school options.",
    },
    {
      firstName: "Sofia",
      lastName: "Alvarez",
      archetype: "Remote Worker Lifestyle Buyer",
      archetypeTag: "remote-worker",
      phone: "202-555-0112",
      city: "Boulder",
      state: "CO",
      budget: 1100000,
      note: "Prioritizes home office setup, mountain access, and fiber internet.",
    },
    {
      firstName: "Marcus",
      lastName: "Liu",
      archetype: "Fix-and-Flip Entrepreneur",
      archetypeTag: "fix-and-flip",
      phone: "202-555-0113",
      city: "Lakewood",
      state: "CO",
      budget: 690000,
      note: "Targets cosmetic rehab properties with 6-month resale windows.",
    },
    {
      firstName: "Linda",
      lastName: "Carver",
      archetype: "Pre-Retirement Downsizer",
      archetypeTag: "pre-retirement",
      phone: "202-555-0114",
      city: "Arvada",
      state: "CO",
      budget: 720000,
      note: "Wants one-level living, low maintenance, and space for visiting family.",
    },
    {
      firstName: "Jamal",
      lastName: "Washington",
      archetype: "Out-of-State Landlord Investor",
      archetypeTag: "landlord-investor",
      phone: "202-555-0115",
      city: "Thornton",
      state: "CO",
      budget: 1350000,
      note: "Evaluates cash flow, vacancy rates, and professional management options.",
    },
  ],
};

const personas = personaBatches[batch] || personaBatches[1];

function isoInDays(days, hour = 16) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateInDays(days) {
  return isoInDays(days).slice(0, 10);
}

function emailForPersona(p, index) {
  const clean = `${p.firstName}.${p.lastName}`.toLowerCase();
  return `${clean}+${Date.now()}-${index}@example.com`;
}

async function fubRequest(path, body) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      "X-System": X_SYSTEM,
      "X-System-Key": X_SYSTEM_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const details = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`POST ${path} failed (${response.status}): ${details}`);
  }

  return data;
}

function extractId(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.id === "number") return data.id;
  if (typeof data.personId === "number") return data.personId;
  if (data.person && typeof data.person.id === "number") return data.person.id;
  if (Array.isArray(data.people) && typeof data.people[0]?.id === "number") return data.people[0].id;
  return null;
}

async function seedPersona(persona, index) {
  const email = emailForPersona(persona, index);
  const displayName = `${persona.firstName} ${persona.lastName}`;

  const personPayload = {
    firstName: persona.firstName,
    lastName: persona.lastName,
    stage: "Lead",
    source: "Persona Seed Script",
    price: persona.budget,
    emails: [{ value: email, type: "work" }],
    phones: [{ value: persona.phone, type: "mobile" }],
    addresses: [
      {
        type: "home",
        city: persona.city,
        state: persona.state,
        country: "United States",
      },
    ],
    tags: [runTag, batchTag, "persona-seed", persona.archetypeTag],
    background: `${persona.archetype}. ${persona.note}`,
  };

  const personResponse = await fubRequest("/people", personPayload);
  const personId = extractId(personResponse);

  if (!personId) {
    throw new Error(`Could not extract person id from /people response for ${displayName}.`);
  }

  const noteBody = `${displayName} profile: ${persona.archetype}. ${persona.note} Budget target: $${persona.budget.toLocaleString()}.`;

  return { personId, displayName, email, archetype: persona.archetype };
}

async function createEmailCampaign() {
  const campaignStamp = new Date().toISOString().replaceAll(":", "-");
  const payload = {
    origin: "Persona Seed Script",
    originId: `${runTag}-${batchTag}-${campaignStamp}`,
    name: `Persona Seed Campaign ${batchTag} ${runTag}`,
    subject: "Persona Nurture Sequence",
    bodyHtml: "<p>Thanks for connecting. We will share tailored next steps shortly.</p>",
  };
  const response = await fubRequest("/emCampaigns", payload);
  const id = extractId(response);
  if (!id) {
    throw new Error("Could not extract campaign id from /emCampaigns response.");
  }
  return id;
}

async function runActivitySteps({ personId, persona, displayName, email, campaignId }) {
  const errors = [];

  const steps = [
    {
      name: "note",
      body: {
        personId,
        subject: "Persona Intake Summary",
        body: `${displayName} profile: ${persona.archetype}. ${persona.note} Budget target: $${persona.budget.toLocaleString()}.`,
        isHtml: false,
      },
      path: "/notes",
    },
    {
      name: "call",
      body: {
        personId,
        phone: persona.phone,
        isIncoming: false,
        note: `Discovery call completed for ${persona.archetype}. Confirmed timeline and financing stance.`,
        outcome: "Interested",
        duration: 540,
        toNumber: persona.phone,
        fromNumber: "303-555-0199",
      },
      path: "/calls",
    },
    {
      name: "text",
      body: {
        personId,
        message: `Hi ${persona.firstName}, thanks for the call. I pulled 3 options aligned with your ${persona.archetype.toLowerCase()} goals.`,
        toNumber: persona.phone,
        fromNumber: "303-555-0199",
        isIncoming: false,
        externalLabel: "Persona seed text",
        externalUrl: "https://example.com/persona-seed",
      },
      path: "/textMessages",
    },
    {
      name: "email",
      body: {
        emEvents: [
          {
            type: "delivered",
            occurred: new Date().toISOString(),
            recipient: email,
            personId,
            campaignId,
            url: "https://example.com/campaign/persona-seed",
          },
        ],
      },
      path: "/emEvents",
    },
    {
      name: "event",
      body: {
        source: "Persona Seed Script",
        system: X_SYSTEM,
        type: "Inquiry",
        message: `${displayName} requested next-step recommendations.`,
        description: `Synthetic event for ${persona.archetype}.`,
        person: { id: personId },
        occurredAt: new Date().toISOString(),
      },
      path: "/events",
    },
    {
      name: "task",
      body: {
        personId,
        type: "Follow Up",
        dueDate: dateInDays(2),
        remindSecondsBefore: 7200,
      },
      path: "/tasks",
    },
    {
      name: "appointment",
      body: {
        title: `${displayName} Strategy Session`,
        description: `Review next properties and financing plan for ${persona.archetype}.`,
        start: isoInDays(3, 17),
        end: isoInDays(3, 18),
        location: "Video Call",
        invitees: JSON.stringify([{ personId, name: displayName, email }]),
      },
      path: "/appointments",
    },
  ];

  for (const step of steps) {
    try {
      await fubRequest(step.path, step.body);
    } catch (error) {
      errors.push(`${step.name}: ${error.message || String(error)}`);
    }
  }

  return errors;
}

async function main() {
  const summary = {
    batch,
    campaignId: null,
    succeeded: [],
    failed: [],
  };

  summary.campaignId = await createEmailCampaign();

  for (let i = 0; i < personas.length; i += 1) {
    const persona = personas[i];
    const label = `${persona.firstName} ${persona.lastName}`;

    process.stdout.write(`Seeding ${label}... `);
    try {
      const result = await seedPersona(persona, i);
      const activityErrors = await runActivitySteps({
        personId: result.personId,
        persona,
        displayName: result.displayName,
        email: result.email,
        campaignId: summary.campaignId,
      });

      if (activityErrors.length === 0) {
        summary.succeeded.push(result);
        console.log(`ok (personId=${result.personId})`);
      } else {
        summary.failed.push({
          name: label,
          personId: result.personId,
          error: activityErrors.join(" | "),
        });
        console.log(`partial (personId=${result.personId})`);
      }
    } catch (error) {
      summary.failed.push({ name: label, error: String(error.message || error) });
      console.log("failed");
      console.error(`  ${error.message || error}`);
    }
  }

  console.log("\nSeed summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
