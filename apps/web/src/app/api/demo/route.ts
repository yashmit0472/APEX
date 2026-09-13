import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") ?? "status";

  try {
    const res = await fetch(
      `${GATEWAY_URL}/v1/demo/${endpoint}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gateway unreachable",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint") ?? "start";

  try {
    const body = await request.json().catch(() => ({}));

    const res = await fetch(
      `${GATEWAY_URL}/v1/demo/${endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gateway unreachable",
      },
      { status: 502 }
    );
  }
}
