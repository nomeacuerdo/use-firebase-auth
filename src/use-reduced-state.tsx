import { useReducer, Dispatch } from "react";
import { FirebaseError } from "firebase/app";
import { User } from "firebase/auth";
interface State {
  user?: User | undefined
  loading?: boolean | undefined
  error?: FirebaseError
  firstCheck?: boolean | undefined
  setState?: Dispatch<State>
}

export function useReducedState(initialState: State) {
  const reducedState = useReducer(
    (oldState: State, newState: State) => ({ ...oldState, ...newState }),
    initialState,
  )
  return reducedState
}
