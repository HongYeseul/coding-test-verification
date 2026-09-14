import test from "node:test";
import assert from "node:assert/strict";

import {
  compareGoal,
  formatClock,
  formatDuration,
  formatDurationCompact,
  formatOpenSeat,
  formatRecord,
  formatSeatRange,
  isRecordKind,
  nowClockMinutes,
  parseClock,
} from "../src/lib/record-goal.ts";

test("시각은 자정부터 흐른 분으로 오간다", () => {
  assert.equal(formatClock(390), "06:30");
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(1439), "23:59");
  // 1440분은 자정이라 다시 00:00입니다.
  assert.equal(formatClock(1440), "00:00");
  assert.equal(parseClock("06:30"), 390);
  assert.equal(parseClock(" 6:05 "), 365);
  assert.equal(parseClock("23:59"), 1439);
});

test("시각 형식이 아니면 받지 않는다", () => {
  assert.equal(parseClock("24:00"), null);
  assert.equal(parseClock("06:60"), null);
  assert.equal(parseClock("630"), null);
  assert.equal(parseClock(""), null);
});

test("시간은 읽는 자리와 좁은 자리에서 형식만 갈린다", () => {
  assert.equal(formatDuration(260), "4시간 20분");
  assert.equal(formatDuration(240), "4시간");
  assert.equal(formatDuration(20), "20분");
  assert.equal(formatDurationCompact(260), "4시간20분");
  assert.equal(formatRecord("DURATION", 260, true), "4시간20분");
  assert.equal(formatRecord("CLOCK", 260), "04:20");
  assert.equal(formatRecord("NONE", 260), "");
});

test("시각과 시간은 목표를 못 지킨 방향이 서로 반대다", () => {
  // 시각은 목표보다 늦으면 모자란 것입니다.
  assert.equal(compareGoal("CLOCK", 402, 390).missed, true);
  assert.equal(compareGoal("CLOCK", 402, 390).short, "+12");
  assert.equal(compareGoal("CLOCK", 380, 390).missed, false);
  assert.equal(compareGoal("CLOCK", 390, 390).short, "정시");
  // 시간은 목표보다 짧으면 모자란 것입니다.
  assert.equal(compareGoal("DURATION", 150, 180).missed, true);
  assert.equal(compareGoal("DURATION", 210, 180).missed, false);
  assert.equal(compareGoal("DURATION", 180, 180).short, "달성");
});

test("목표가 없으면 견줄 것도 없다", () => {
  assert.equal(compareGoal("CLOCK", 390, null), null);
  assert.equal(compareGoal("NONE", 390, 390), null);
});

test("착석과 퇴근은 시각 두 개로 읽힌다", () => {
  // 13:00에 앉아 4시간 20분 있었으면 17:20에 일어난 것입니다.
  assert.equal(formatSeatRange(780, 260), "13:00 → 17:20");
  // 자정을 넘겨 앉아 있었어도 끝 시각이 하루를 넘지 않습니다.
  assert.equal(formatSeatRange(1380, 120), "23:00 → 01:00");
  assert.equal(formatOpenSeat(780), "13:00~");
});

test("기록 종류는 세 값뿐이다", () => {
  assert.equal(isRecordKind("CLOCK"), true);
  assert.equal(isRecordKind("DURATION"), true);
  assert.equal(isRecordKind("NONE"), true);
  assert.equal(isRecordKind("WAKE"), false);
  assert.equal(isRecordKind(null), false);
});

test("지금 시각은 한국시간 자정부터의 분이다", () => {
  // 한국시간 2026-09-14 06:30에 해당하는 순간입니다.
  const at = new Date("2026-09-13T21:30:00Z");
  assert.equal(nowClockMinutes(at), 390);
  // 한국시간 자정은 24시가 아니라 0분입니다.
  assert.equal(nowClockMinutes(new Date("2026-09-13T15:00:00Z")), 0);
});
