import fs from "node:fs";

export const runtime = "nodejs";

const ASSET_1 = "C:\\dev\\vmb-team\\assets\\adem-ay-Tk9m_HP4rgQ-unsplash.jpg";
const ASSET_2 = "C:\\dev\\vmb-team\\assets\\simon-kadula--gkndM1GvSA-unsplash.jpg";
const ASSET_3 = "C:\\dev\\vmb-team\\assets\\or-hakim-0jR7w4OW5SQ-unsplash.jpg";
const ASSET_4 = "C:\\dev\\vmb-team\\assets\\giorgio-trovato-OKXwmdbdXkk-unsplash.jpg";
const ASSET_5 = "C:\\dev\\vmb-team\\assets\\simon-kadula--gkndM1GvSA-unsplash.jpg";
const ASSET_6 = "C:\\dev\\vmb-team\\assets\\towfiqu-barbhuiya-bwOAixLG0uc-unsplash.jpg";
const ASSET_7 = "C:\\dev\\vmb-team\\assets\\melissa-askew-tSlvoSZK77c-unsplash.jpg";
const ASSET_8 = "C:\\dev\\vmb-team\\assets\\brooke-cagle-BMLPa7HBnQQ-unsplash.jpg";
const ASSET_9 = "C:\\dev\\vmb-team\\assets\\patrick-tomasso-fMntI8HAAB8-unsplash.jpg";
const ASSET_10 = "C:\\dev\\vmb-team\\assets\\jodene-isakowitz-hvqHtZqNMeI-unsplash.jpg";
const ASSET_11 = "C:\\dev\\vmb-team\\assets\\kevin-laminto-plTEYtXwXok-unsplash.jpg";
const ASSET_12 = "C:\\dev\\vmb-team\\assets\\alexander-grey--8a5eJ1-mmQ-unsplash.jpg";
const ASSET_13 = "C:\\dev\\vmb-team\\assets\\imagine-buddy-vsLbaIdhwaU-unsplash.jpg";
const ASSET_14 = "C:\\dev\\vmb-team\\assets\\van-tay-media-chyT9XPAdcg-unsplash.jpg";
const ASSET_15 = "C:\\dev\\vmb-team\\assets\\blake-wisz-q3o_8MteFM0-unsplash.jpg";
const ASSET_16 = "C:\\dev\\vmb-team\\assets\\elena-rabkina-QH8aF3B0gYQ-unsplash.jpg";
const ASSET_17 = "C:\\dev\\vmb-team\\assets\\alexander-grey--8a5eJ1-mmQ-unsplash (1).jpg";

function pickPath(id: string) {
  if (id === "1") return ASSET_1;
  if (id === "2") return ASSET_2;
  if (id === "3") return ASSET_3;
  if (id === "4") return ASSET_4;
  if (id === "5") return ASSET_5;
  if (id === "6") return ASSET_6;
  if (id === "7") return ASSET_7;
  if (id === "8") return ASSET_8;
  if (id === "9") return ASSET_9;
  if (id === "10") return ASSET_10;
  if (id === "11") return ASSET_11;
  if (id === "12") return ASSET_12;
  if (id === "13") return ASSET_13;
  if (id === "14") return ASSET_14;
  if (id === "15") return ASSET_15;
  if (id === "16") return ASSET_16;
  if (id === "17") return ASSET_17;
  return "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "");
  const filePath = pickPath(id);

  if (!filePath) {
    return new Response("invalid_id", { status: 400 });
  }
  if (!fs.existsSync(filePath)) {
    return new Response("not_found", { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
