import { AnaesthetistComment } from '../../services/preSurgicalConferenceService';
import { Stethoscope, Calendar, User, MessageSquare, AlertTriangle } from 'lucide-react';

interface Props {
  comments: AnaesthetistComment[];
}

export default function AnaesthetistCommentsSlide({ comments }: Props) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Stethoscope className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-lg sm:text-2xl font-bold text-gray-400">No Anaesthetist Review</h2>
        <p className="text-gray-500 mt-2">Patient has not been reviewed by an anaesthetist yet</p>
        <div className="mt-6 bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 max-w-md">
          <div className="flex items-center space-x-2 text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Action Required</span>
          </div>
          <p className="text-yellow-200 text-sm mt-2">
            Please ensure the patient is reviewed by an anaesthetist before the surgical conference
          </p>
        </div>
      </div>
    );
  }

  // Get the most recent comment (primary)
  const latestComment = comments[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Anaesthetist Assessment</h1>
        <p className="text-gray-400 mt-2">{comments.length} review(s) on record</p>
      </div>

      {/* Latest Assessment Card */}
      <div className="bg-gradient-to-br from-teal-900/50 to-teal-800/30 rounded-2xl p-8 border border-teal-500/30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{latestComment.anaesthetist_name}</h3>
              <p className="text-sm text-gray-400">Consultant Anaesthetist</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date(latestComment.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Assessment Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {latestComment.asa_grade && (
            <AssessmentBadge 
              label="ASA Grade" 
              value={latestComment.asa_grade}
              color="bg-blue-600"
            />
          )}
          {latestComment.airway_assessment && (
            <AssessmentBadge 
              label="Airway" 
              value={latestComment.airway_assessment}
              color="bg-purple-600"
            />
          )}
          {latestComment.anesthesia_plan && (
            <AssessmentBadge 
              label="Anesthesia Plan" 
              value={latestComment.anesthesia_plan}
              color="bg-green-600"
            />
          )}
        </div>

        {/* Main Comment */}
        <div className="bg-black/20 rounded-xl p-6">
          <div className="flex items-center space-x-2 mb-3 text-teal-400">
            <MessageSquare className="h-5 w-5" />
            <span className="font-semibold">Assessment Notes</span>
          </div>
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap text-lg">
            {latestComment.comment}
          </p>
        </div>
      </div>

      {/* Previous Comments */}
      {comments.length > 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-400">Previous Reviews</h3>
          <div className="space-y-3">
            {comments.slice(1).map((comment) => (
              <div key={comment.id} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{comment.anaesthetist_name}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{comment.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/10 rounded-lg p-4 text-center">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className={`${color} inline-block px-3 py-1 rounded-full text-sm font-bold`}>
        {value}
      </div>
    </div>
  );
}
