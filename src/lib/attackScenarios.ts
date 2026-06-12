import type { Credential } from "./api";

export interface AttackScenario {
  id: string;
  label: string;
  description: string;
  expected: string;
  transform: (c: Credential) => Credential;
}

function clone(c: Credential): Credential {
  return JSON.parse(JSON.stringify(c));
}

function mutateString(s: string): string {
  if (!s || s.length < 4) return "X";
  const mid = Math.floor(s.length / 2);
  const ch = s.charAt(mid);
  const next = ch === "A" ? "B" : "A";
  return s.slice(0, mid) + next + s.slice(mid + 1);
}

export const attackScenarios: AttackScenario[] = [
  {
    id: "tamper-subject",
    label: "① subject改竄",
    description:
      "credentialSubject.name を『Mallory』に書き換え (受信者なりすまし)",
    expected: "署名検証 × (改竄検知)",
    transform: (orig) => {
      const c = clone(orig);
      const subj = c.credentialSubject as Record<string, unknown>;
      subj.name = "Mallory";
      return c;
    },
  },
  {
    id: "tamper-achievement",
    label: "② achievement改竄",
    description: "achievement.name を偽の上位資格名に書き換え",
    expected: "署名検証 × (改竄検知)",
    transform: (orig) => {
      const c = clone(orig);
      const subj = c.credentialSubject as Record<string, unknown>;
      const ach = subj.achievement as Record<string, unknown>;
      ach.name = "Upgraded Fake Master Certification";
      return c;
    },
  },
  {
    id: "tamper-proof",
    label: "③ proof改竄",
    description: "proofValue の末尾 1 文字を書き換え (署名バイト列を壊す)",
    expected: "署名検証 × (改竄検知)",
    transform: (orig) => {
      const c = clone(orig);
      const p = c.proof as Record<string, unknown>;
      p.proofValue = mutateString(p.proofValue as string);
      return c;
    },
  },
  {
    id: "tamper-issuer",
    label: "④ Issuerなりすまし",
    description:
      "issuer.id を別の did:key に差し替え (別人が発行したと主張)",
    expected: "署名検証 × (キー不一致)",
    transform: (orig) => {
      const c = clone(orig);
      const iss = c.issuer as Record<string, unknown>;
      iss.id = "did:key:z6MkFAKEIMPERSONATOR000000000000000000000000";
      return c;
    },
  },
  {
    id: "tamper-validfrom",
    label: "⑤ 期限改竄",
    description: "validFrom を未来日付に書き換え (有効期間偽装)",
    expected: "署名検証 × (JSON-LD canonicalize に含まれるため)",
    transform: (orig) => {
      const c = clone(orig);
      const future = new Date();
      future.setFullYear(future.getFullYear() + 10);
      c.validFrom = future.toISOString();
      return c;
    },
  },
  {
    id: "tamper-context",
    label: "⑥ context削除",
    description: "@context の OB 3.0 を外す (意味を変える攻撃)",
    expected: "署名検証 × または schema 違反",
    transform: (orig) => {
      const c = clone(orig);
      const ctx = c["@context"] as string[];
      c["@context"] = ctx.filter((u) => !u.includes("purl.imsglobal.org"));
      return c;
    },
  },
];
