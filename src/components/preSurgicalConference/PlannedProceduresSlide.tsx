import { PlannedProcedure } from '../../services/preSurgicalConferenceService';
import { Scissors, Calendar, Clock, User, MapPin, Syringe, Package } from 'lucide-react';

interface Props {
  procedures: PlannedProcedure[];
}

export default function PlannedProceduresSlide({ procedures }: Props) {
  if (procedures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Scissors className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-400">No Planned Procedures</h2>
        <p className="text-gray-500 mt-2">No surgical procedures have been scheduled for this patient</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Scissors className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold">Planned Procedures</h1>
        <p className="text-gray-400 mt-2">{procedures.length} procedure(s) scheduled</p>
      </div>

      <div className="space-y-6">
        {procedures.map((procedure, index) => (
          <ProcedureCard key={procedure.id} procedure={procedure} index={index + 1} />
        ))}
      </div>
    </div>
  );
}

function ProcedureCard({ procedure, index }: { procedure: PlannedProcedure; index: number }) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled': return 'bg-blue-600 text-blue-100';
      case 'confirmed': return 'bg-green-600 text-green-100';
      case 'pending': return 'bg-yellow-600 text-yellow-100';
      case 'completed': return 'bg-gray-600 text-gray-100';
      default: return 'bg-gray-600 text-gray-100';
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return 'TBD';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };

  return (
    <div className="bg-gradient-to-br from-rose-900/40 to-rose-800/20 rounded-2xl overflow-hidden border border-rose-500/30">
      {/* Header */}
      <div className="bg-rose-700/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-rose-600 rounded-full flex items-center justify-center text-lg font-bold">
            {index}
          </div>
          <div>
            <h3 className="text-xl font-bold">{procedure.procedure_name}</h3>
            <p className="text-sm text-gray-300">{procedure.procedure_type}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(procedure.status)}`}>
          {procedure.status}
        </span>
      </div>

      {/* Details Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <DetailItem 
            icon={<Calendar className="h-5 w-5" />}
            label="Scheduled Date"
            value={procedure.scheduled_date 
              ? new Date(procedure.scheduled_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              : 'TBD'
            }
          />
          <DetailItem 
            icon={<Clock className="h-5 w-5" />}
            label="Est. Duration"
            value={formatDuration(procedure.estimated_duration)}
          />
          <DetailItem 
            icon={<MapPin className="h-5 w-5" />}
            label="Operating Room"
            value={procedure.operating_room || 'TBD'}
          />
          <DetailItem 
            icon={<Syringe className="h-5 w-5" />}
            label="Anesthesia"
            value={procedure.anesthesia_type || 'TBD'}
          />
        </div>

        {procedure.surgeon_name && (
          <div className="flex items-center space-x-2 mb-4 text-green-400">
            <User className="h-4 w-4" />
            <span className="text-sm">Surgeon: <strong>{procedure.surgeon_name}</strong></span>
          </div>
        )}

        {/* Pre-op Notes */}
        {procedure.pre_op_notes && (
          <div className="bg-black/20 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-rose-400 mb-2">Pre-operative Notes</h4>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{procedure.pre_op_notes}</p>
          </div>
        )}

        {/* Required Equipment */}
        {procedure.required_equipment && procedure.required_equipment.length > 0 && (
          <div className="bg-black/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-rose-400 mb-2 flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Required Equipment</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {procedure.required_equipment.map((item: any, i: number) => (
                <span key={i} className="bg-rose-600/30 px-3 py-1 rounded-full text-sm">
                  {typeof item === 'string' ? item : item.name || item.item_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-rose-400 mb-1 flex justify-center">{icon}</div>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
