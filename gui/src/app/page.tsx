"use client";

import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { increment, decrement, selectCount } from "@/lib/features/counterSlice";

export default function Home() {
  const count = useAppSelector(selectCount);
  const dispatch = useAppDispatch();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Next.js + Flask Template</h1>

      <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-secondary">
        <p className="text-lg">Redux Counter: {count}</p>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch(decrement())}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            -
          </button>
          <button
            onClick={() => dispatch(increment())}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-8 text-muted-foreground text-sm">
        <p>Frontend: Next.js + Redux + Tailwind CSS</p>
        <p>Backend: Flask</p>
      </div>
    </main>
  );
}
