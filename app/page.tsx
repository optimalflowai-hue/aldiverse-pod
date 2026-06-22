'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 font-sans text-foreground overflow-hidden transition-colors duration-300">
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="z-10 text-center space-y-5 max-w-2xl px-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          <span>In-House Print Fulfillment</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-none">
          Aldiverse Print-on-Demand <br />
          <span className="text-muted-foreground font-medium text-2xl md:text-4xl">Management Platform</span>
        </h1>

        <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Manage client manuscripts, compile print templates, trace Stripe checkout transactions, and automate Lulu API shipping fulfillment.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => router.push('/console')}
            className="flex items-center gap-2 px-5 h-11 bg-primary text-primary-foreground font-semibold rounded-md transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm"
          >
            <span>Launch Admin Console</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="absolute bottom-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-semibold"
      >
        Aldiverse POD Platform
      </motion.div>
    </div>
  );
}
