"use client";

import { createContext } from "react";

/** 상세 모달의 여러 저장 폼이 한 번에 하나만 저장하고 다른 입력도 같은 시간 동안 잠기도록 공유한다. */
export const CatalogSaveScope = createContext<{ busy: boolean; acquire: () => boolean; release: () => void } | null>(null);
