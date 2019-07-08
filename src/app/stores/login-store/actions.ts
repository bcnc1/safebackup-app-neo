import { Action } from '@ngrx/store';
import { M5Result, Member } from '../../models';

export enum ActionTypes {
  SUCCESS = '[STATE] LOGGEDIN',
  FAILURE = '[STATE] FAILED',
  LOGGEDOUT = '[STATE] LOGGEDOUT',
}

export class SuccessAction implements Action {
  readonly type = ActionTypes.SUCCESS;
  constructor(public member: Member) {}
}

export class FailureAction implements Action {
  readonly type = ActionTypes.FAILURE;
  constructor(public error: string) {}
}

export class LoggedOutAction implements Action {
  readonly type = ActionTypes.LOGGEDOUT;
  constructor() {}
}

export type Actions = SuccessAction | FailureAction | LoggedOutAction;
