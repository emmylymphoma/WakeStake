import { createInitialState } from '../domain/defaults';
import { applyFreeSnooze, applyRestake, applySnooze, applyWake, startSession } from '../domain/rules';
import type {
  AlarmConfig,
  AppState,
  Charity,
  Profile,
  ShamePost,
  SnoozeEvent,
  StakeConfig,
  Wallet,
  WakeCode,
} from '../domain/types';

export type Action =
  | { type: 'SET_PROFILE'; profile: Profile }
  | { type: 'SET_STAKE'; stake: StakeConfig; wallet: Wallet }
  | { type: 'SET_ALARM'; alarm: AlarmConfig }
  | { type: 'SET_CHARITY'; charity: Charity }
  | { type: 'SET_WAKE_CODE'; wakeCode: WakeCode }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'ALARM_RING'; at: string }
  | { type: 'FREE_SNOOZE'; at: string }
  | { type: 'SNOOZE_RECORDED'; event: SnoozeEvent }
  | { type: 'POST_PUBLISHED'; eventId: string; post: ShamePost }
  | { type: 'WAKE' }
  | { type: 'RESTAKE' }
  | { type: 'RESET' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: action.profile };
    case 'SET_STAKE':
      return { ...state, stake: action.stake, wallet: action.wallet, balance: action.stake.amount };
    case 'SET_ALARM':
      return { ...state, alarm: action.alarm };
    case 'SET_CHARITY':
      return { ...state, charity: action.charity };
    case 'SET_WAKE_CODE':
      return { ...state, wakeCode: action.wakeCode };
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboarded: true };
    case 'ALARM_RING':
      return startSession(state, action.at);
    case 'FREE_SNOOZE':
      return applyFreeSnooze(state, action.at);
    case 'SNOOZE_RECORDED':
      return applySnooze(state, action.event);
    case 'POST_PUBLISHED':
      return {
        ...state,
        history: state.history.map((e) => (e.id === action.eventId ? { ...e, post: action.post } : e)),
      };
    case 'WAKE':
      return applyWake(state);
    case 'RESTAKE':
      return applyRestake(state);
    case 'RESET':
      return createInitialState();
  }
}
