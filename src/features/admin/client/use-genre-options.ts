"use client";

import type { GenreOption } from "../genre-options-contracts";
import { useAdminOptions } from "./use-admin-options";

/** 검색을 짧게 지연하고 이전 검색·닫힌 선택기의 응답을 취소한다. 선택한 장르는 이 검색 상태와 분리한다. */
export function useGenreOptions(open: boolean, search: string, revision: number) {
  // 이전 이어 읽기의 종료 응답을 기다리지 않고 새 검색에서 필요한 요청을 바로 시작할 수 있게 한다.
  // 요청 수명 관리는 공통 훅에 맡기고 장르 조회 경로·타입만 이 래퍼가 소유한다.
  return useAdminOptions<GenreOption>("game-genres/options", "장르", open, search, revision);
}
