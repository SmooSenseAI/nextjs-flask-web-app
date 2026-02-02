"use client";

import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { increment, decrement, selectCount } from "@/lib/features/counterSlice";
import { Button } from "@/components/ui/button";

export default function Home() {
  const count = useAppSelector(selectCount);
  const dispatch = useAppDispatch();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Next.js + Flask Template</h1>

      <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-secondary">
        <p className="text-lg">Redux Counter: {count}</p>
        <div className="flex gap-2">
          <Button onClick={() => dispatch(decrement())}>-</Button>
          <Button onClick={() => dispatch(increment())}>+</Button>
        </div>
      </div>

      <div className="mt-8 text-muted-foreground text-sm">
        <p>Frontend: Next.js + Redux + Tailwind CSS</p>
        <p>Backend: Flask</p>
      </div>
    </main>
  );
}
