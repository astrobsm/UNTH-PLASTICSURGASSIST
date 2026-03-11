import React, { useState, useEffect } from 'react';
import { Clock, FileText, Activity, Pill, Stethoscope } from 'lucide-react';
import { db } from '../db/database';
import { format } from 'date-fns';

interface PatientChronologicalTimelineProps {
  patientId: string;
  hospitalNumber: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'admission' | 'ward_round' | 'procedure' | 'lab' | 'prescription' | 'note' | 'discharge';
  title: string;
  description: string;
  author?: string;
}

export function PatientChronologicalTimeline({ patientId, hospitalNumber }: PatientChronologicalTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [patientId]);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const timelineEvents: TimelineEvent[] = [];

      // Load ward rounds
      const wardRounds = await db.wardRounds
        .where('patient_id').equals(patientId)
        .or('hospital_number').equals(hospitalNumber)
        .toArray();
      wardRounds.forEach(wr => {
        timelineEvents.push({
          id: `wr_${wr.id}`,
          date: new Date(wr.date || wr.created_at || new Date()),
          type: 'ward_round',
          title: 'Ward Round',
          description: (wr as any).assessment || (wr as any).plan || 'Ward round documented',
          author: (wr as any).doctor_name
        });
      });

      // Load progress notes
      const notes = await db.progressNotes
        .where('patient_id').equals(patientId)
        .or('hospital_number').equals(hospitalNumber)
        .toArray();
      notes.forEach(n => {
        timelineEvents.push({
          id: `note_${n.id}`,
          date: new Date(n.created_at || new Date()),
          type: 'note',
          title: 'Progress Note',
          description: (n as any).content || (n as any).subjective || 'Progress note',
          author: (n as any).author
        });
      });

      // Sort by date descending
      timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEvents(timelineEvents);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ward_round': return <Stethoscope className="h-4 w-4" />;
      case 'procedure': return <Activity className="h-4 w-4" />;
      case 'lab': return <FileText className="h-4 w-4" />;
      case 'prescription': return <Pill className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'admission': return 'bg-blue-500';
      case 'ward_round': return 'bg-green-500';
      case 'procedure': return 'bg-purple-500';
      case 'lab': return 'bg-yellow-500';
      case 'prescription': return 'bg-orange-500';
      case 'discharge': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No timeline events yet</p>
        <p className="text-sm">Events will appear here as clinical activities are documented.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-green-600" />
        Patient Timeline
      </h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        {events.map((event) => (
          <div key={event.id} className="relative pl-10 pb-6">
            <div className={`absolute left-2.5 w-3 h-3 rounded-full ${getEventColor(event.type)} ring-2 ring-white`} />
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {getEventIcon(event.type)}
                  {event.title}
                </div>
                <span className="text-xs text-gray-500">
                  {format(event.date, 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
              {event.author && (
                <p className="text-xs text-gray-400 mt-1">By: {event.author}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PatientChronologicalTimeline;
