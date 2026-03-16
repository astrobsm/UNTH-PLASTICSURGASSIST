import { AlertCircle, AlertTriangle, Info, Heart } from 'lucide-react';
import { Comorbidity } from '../../services/preSurgicalConferenceService';

interface Props {
  comorbidities: Comorbidity[];
}

export default function ComorbiditiesSlide({ comorbidities }: Props) {
  const getSeverityConfig = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'severe':
        return { bg: 'bg-red-900/40', border: 'border-red-500', text: 'text-red-300', icon: AlertCircle, badge: 'bg-red-600' };
      case 'moderate':
        return { bg: 'bg-yellow-900/40', border: 'border-yellow-500', text: 'text-yellow-300', icon: AlertTriangle, badge: 'bg-yellow-600' };
      case 'mild':
        return { bg: 'bg-green-900/40', border: 'border-green-500', text: 'text-green-300', icon: Info, badge: 'bg-green-600' };
      default:
        return { bg: 'bg-gray-800/40', border: 'border-gray-500', text: 'text-gray-300', icon: Info, badge: 'bg-gray-600' };
    }
  };

  if (comorbidities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mb-4">
          <Heart className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-lg sm:text-2xl font-bold text-green-400">No Known Comorbidities</h2>
        <p className="text-gray-400 mt-2">No comorbidities have been documented for this patient</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Comorbidities</h1>
        <p className="text-gray-400 mt-2">{comorbidities.length} condition(s) documented</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {comorbidities.map((comorbidity, index) => {
          const config = getSeverityConfig(comorbidity.severity);
          const SeverityIcon = config.icon;
          return (
            <div
              key={index}
              className={`${config.bg} border ${config.border} rounded-xl p-6`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <SeverityIcon className={`h-6 w-6 ${config.text} mt-1 flex-shrink-0`} />
                  <div>
                    <h3 className={`text-lg font-bold ${config.text}`}>{comorbidity.name}</h3>
                    {comorbidity.notes && (
                      <p className="text-sm text-gray-300 mt-2">{comorbidity.notes}</p>
                    )}
                  </div>
                </div>
                <span className={`${config.badge} text-white text-xs font-bold px-3 py-1 rounded-full uppercase`}>
                  {comorbidity.severity || 'Unknown'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span className="text-lg font-semibold">Total Comorbidities: </span>
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-400">{comorbidities.length}</span>
          </div>
          <div className="flex space-x-4">
            {['severe', 'moderate', 'mild'].map(level => {
              const count = comorbidities.filter(c => c.severity?.toLowerCase() === level).length;
              if (count === 0) return null;
              const cfg = getSeverityConfig(level);
              return (
                <div key={level} className="text-center">
                  <span className={`${cfg.badge} text-white text-xs font-bold px-3 py-1 rounded-full uppercase`}>
                    {level}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
