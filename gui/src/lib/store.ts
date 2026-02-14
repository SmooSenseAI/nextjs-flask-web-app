import { configureStore } from "@reduxjs/toolkit";
import counterReducer from "./features/counterSlice";
import etradeReducer from "./features/etradeSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      counter: counterReducer,
      etrade: etradeReducer,
    },
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
