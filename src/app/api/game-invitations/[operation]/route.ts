import { readBrowserProof } from "@/features/auth/server/browser-proof";
import { withAuthenticatedSession } from "@/features/auth/server/refresh";
import { isSessionId } from "@/features/auth/session-id";
import {
  isGameInvitation,
  isInvitationDecision,
} from "@/features/game-invitations/contracts";
import { object, uuid } from "@/features/social/contracts";
import { ApiError, apiErrorResponse } from "@/lib/server/api-error";
import { backendRequest } from "@/lib/server/backend-client";
import { readJsonBody } from "@/lib/server/request-body";
import { assertSameOrigin } from "@/lib/server/request-security";

/** 등록한 게임·동작·필드만 허용한다. 초대는 서버 권한 검증을 통과한 공개 값으로만 반환한다. */
export async function POST(
  request: Request,
  context: { params: Promise<{ operation: string }> },
) {
  try {
    assertSameOrigin(request);
    const { operation } = await context.params;
    if (!["send", "accept", "reject", "cancel"].includes(operation))
      return new Response(null, { status: 404 });
    const proof = await readBrowserProof(request.clone());
    const input = await readJsonBody(request, 1024);
    if (
      !object(input) ||
      !isSessionId(input.sessionId) ||
      input.game !== "shooting"
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    const fields =
      operation === "send"
        ? ["roomId", "targetId", "requestId"]
        : ["invitationId"];
    if (
      Object.keys(input).some(
        (key) => !["sessionId", "game", ...fields].includes(key),
      )
    )
      throw new ApiError("INVALID_REQUEST_BODY");
    const body: Record<string, unknown> = { game: input.game };
    for (const field of fields) {
      const value = input[field];
      if (
        typeof value !== "string" ||
        !(field === "roomId" ? /^[A-Z2-9]{8}$/.test(value) : uuid.test(value))
      )
        throw new ApiError("INVALID_REQUEST_BODY");
      body[field] = value;
    }
    const value = await withAuthenticatedSession(
      proof,
      (accessToken, proof) =>
        backendRequest(`/api/game-invitations/${operation}`, {
          method: "POST",
          body,
          accessToken,
          proof,
        }),
      input.sessionId,
    );
    if (operation === "send") {
      if (!isGameInvitation(value))
        throw new ApiError("INVALID_BACKEND_RESPONSE");
      const person = (p: typeof value.inviter) => ({
        publicId: p.publicId,
        nickname: p.nickname,
        avatarId: p.avatarId,
        relation: p.relation,
      });
      return Response.json(
        {
          id: value.id,
          game: value.game,
          roomId: value.roomId,
          roomTitle: value.roomTitle,
          inviter: person(value.inviter),
          target: person(value.target),
          expiresAt: value.expiresAt,
          sessionId: input.sessionId,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (!isInvitationDecision(value))
      throw new ApiError("INVALID_BACKEND_RESPONSE");
    return Response.json(
      { state: value.state, roomId: value.roomId, sessionId: input.sessionId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
