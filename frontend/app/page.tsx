"use client";

import { CategoryList } from "@/components/category-list"
import React from "react"

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 mt-10">
        <h1 className="text-3xl font-bold tracking-tight">ArXiv Research Summaries</h1>
        <p className="text-sm text-muted-foreground">
          Get the latest research paper summaries from arXiv, updated daily.
        </p>

        <p className=" text-muted-foreground text-sm">
          Built by <a href="https://x.com/theyuggupta" className="text-primary">Yug Gupta</a>
        </p>
      </div>
      <CategoryList />

      <div className="flex flex-col gap-2  mt-10">
       
      </div>
    </div>
  )
}

function TabButton({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-background/50 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
