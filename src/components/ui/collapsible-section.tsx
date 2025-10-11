'use client';

import { useState, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, description, icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 group"
        style={{
          transition: 'background-color 800ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <div
                className="group-hover:text-primary"
                style={{
                  transition: 'color 800ms cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {icon}
              </div>
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="mt-2">{description}</CardDescription>
            )}
          </div>
          <div
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 800ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <svg
              className="w-5 h-5 text-muted-foreground group-hover:text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{
                transition: 'color 800ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </CardHeader>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 800ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden'
        }}
      >
        <div style={{ minHeight: 0 }}>
          <CardContent
            style={{
              paddingTop: isOpen ? '1.5rem' : '0',
              paddingBottom: isOpen ? '1.5rem' : '0',
              transition: 'padding 800ms cubic-bezier(0.4, 0, 0.2, 1), opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: isOpen ? 1 : 0
            }}
          >
            {children}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
