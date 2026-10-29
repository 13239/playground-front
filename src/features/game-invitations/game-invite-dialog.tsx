"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { SearchInput } from "@/components/ui/search-input";
import { NumberedPagination } from "@/features/admin/components/numbered-pagination";
import { AuthRequestError } from "@/features/auth/client/api";
import { ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { useSocial, useSocialStore } from "@/features/social/context";
import {
  isSnapshot,
  type Page,
  type Person,
} from "@/features/social/contracts";
import { createUuidV4 } from "@/lib/client/uuid";
import { sendGameInvitation, invitationGames } from "./registry";
import { collectGameInvitations, type InvitationGame } from "./contracts";
import { RoomDialog } from "@/components/ui/game-dialog";
import { useInvitationRemaining } from "./game-invitation-host";
import styles from "./game-invitation.module.css";

/** 친구 선택은 현재 홈의 검색·페이지를 변경하지 않고 공통 인증·친구 조회를 재사용한다. */
export function GameInviteDialog({
  game,
  roomId,
  pageId = "",
  sessionId,
  onClose,
}: {
  game: InvitationGame;
  roomId: number | string;
  pageId?: string;
  sessionId: string;
  onClose: () => void;
}) {
  const social = useSocial();
  const store = useSocialStore();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    friends?: Page<Person>;
    error?: string;
  }>();
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [owner, setOwner] = useState<Document>();
  const busy = useRef(false);
  const bindOwner = useCallback((node: HTMLDivElement | null) => {
    if (node) setOwner(node.ownerDocument);
  }, []);
  const request = useRef<{ target: string; id: string } | null>(null);
  const key = `${sessionId}:${page}:${search}:${epoch}`;
  const outgoing = collectGameInvitations(social.data).find(
    (item) =>
      item.game === game &&
      item.roomId === roomId &&
      item.inviter.publicId === social.data?.self.publicId,
  );
  const remaining = useInvitationRemaining(outgoing, owner);
  const pending = outgoing && remaining > 0 ? outgoing : null;
  const loading = result?.key !== key;
  useEffect(() => {
    const controller = new AbortController();
    void store
      .request("snapshot", { friendPage: page, search }, controller.signal)
      .then((value) => {
        if (
          !controller.signal.aborted &&
          store.getSnapshot().sessionId === sessionId &&
          isSnapshot(value)
        )
          setResult({ key, friends: value.friends });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              failure instanceof AuthRequestError
                ? failure.message
                : "친구 목록을 확인하지 못했어요.",
          });
      });
    return () => controller.abort();
  }, [store, sessionId, page, search, key]);
  async function invite(person: Person) {
    if (
      busy.current ||
      pending ||
      !person.online ||
      store.getSnapshot().sessionId !== sessionId
    )
      return;
    busy.current = true;
    setSending(person.publicId);
    setError("");
    if (request.current?.target !== person.publicId)
      request.current = { target: person.publicId, id: createUuidV4() };
    try {
      await sendGameInvitation(
        game,
        sessionId,
        roomId,
        pageId,
        person.publicId,
        request.current.id,
      );
      request.current = null;
      if (store.getSnapshot().sessionId === sessionId)
        await store.refresh(false);
    } catch (failure) {
      if (store.getSnapshot().sessionId === sessionId)
        setError(
          failure instanceof AuthRequestError
            ? failure.message
            : "초대를 보내지 못했어요. 다시 확인해 주세요.",
        );
      // 결과가 확정된 오류는 다음 시도에서 새 요청을 만들고, 전송 여부 불명확 시 같은 ID로 복원한다.
      if (
        failure instanceof AuthRequestError &&
        failure.status > 0 &&
        failure.status < 500
      )
        request.current = null;
    } finally {
      busy.current = false;
      setSending(null);
    }
  }
  const friends = result?.key === key ? result.friends : undefined;
  return (
    <RoomDialog
      title="친구 초대"
      onClose={onClose}
      busy={!!sending}
      className={styles.dialog}
    >
      <div ref={bindOwner}>
        <p className={styles.hint}>
          온라인 친구를 초대해 보세요. 초대는 15초 동안 유효하며, 한 명의 응답을
          기다릴 수 있어요.
        </p>
        <SearchInput
          label="초대할 친구 검색"
          placeholder="친구 검색"
          maxLength={50}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onSearch={() => {
            setPage(1);
            setSearch(query.trim());
            setEpoch((value) => value + 1);
          }}
        />
        {pending && (
          <div className={styles.pending} role="status">
            <span>
              {pending.target.nickname}님의 응답 대기 중 ·{" "}
              {Math.ceil(remaining / 1000)}초
            </span>
            <button
              type="button"
              className={styles.button}
              disabled={!!social.gameInvitationBusy}
              onClick={() =>
                void store.answerGameInvitation(pending.id, "cancel", game)
              }
            >
              초대 취소
            </button>
          </div>
        )}
        {(error || (result?.key === key && result.error)) && (
          <p className={styles.error} role="alert">
            {error || result?.error}
          </p>
        )}
        {social.gameInvitationError &&
          outgoing &&
          social.gameInvitationError.id === outgoing.id && (
            <p className={styles.error} role="alert">
              {social.gameInvitationError.message}
            </p>
          )}
        {loading ? (
          <p className={styles.empty}>친구 목록을 불러오고 있어요…</p>
        ) : (
          <div className={styles.list}>
            {friends?.items.map((person) => (
              <div key={person.publicId} className={styles.friend}>
                <span className={styles.avatar}>
                  <ProfileAvatar avatarId={person.avatarId} size={44} />
                </span>
                <span className={styles.identity}>
                  <strong>{person.nickname}</strong>
                  <small data-online={!!person.online}>
                    {person.online ? "온라인" : "오프라인"}
                  </small>
                </span>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!person.online || !!sending || !!pending}
                  onClick={() => void invite(person)}
                  aria-label={`${person.nickname}님 ${invitationGames[game].name} 초대`}
                >
                  <Icon name="userPlus" />
                  {sending === person.publicId ? "전송 중…" : "초대"}
                </button>
              </div>
            ))}
          </div>
        )}
        {friends?.total === 0 && (
          <p className={styles.empty}>
            {search
              ? "검색한 친구가 없어요."
              : "아직 친구가 없어요. 함께한 상대의 프로필에서 친구를 추가해 보세요."}
          </p>
        )}
        {friends && friends.total > friends.pageSize && (
          <NumberedPagination
            page={friends.page}
            totalPages={Math.ceil(friends.total / friends.pageSize)}
            loading={loading}
            change={setPage}
            label="초대할 친구 목록 페이지"
          />
        )}
      </div>
    </RoomDialog>
  );
}
