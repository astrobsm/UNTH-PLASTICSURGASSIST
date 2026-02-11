import { PreparingTeamMember } from '../../services/preSurgicalConferenceService';
import { Users, Calendar, CheckCircle, Award } from 'lucide-react';

interface Props {
  team: PreparingTeamMember[];
}

export default function PreparingTeamSlide({ team }: Props) {
  if (team.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Users className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-400">No Team Members Recorded</h2>
        <p className="text-gray-500 mt-2">Team preparation records have not been logged</p>
      </div>
    );
  }

  // Group by role
  const residents = team.filter(m => 
    m.role.toLowerCase().includes('registrar') || 
    m.role.toLowerCase().includes('resident')
  );
  const houseOfficers = team.filter(m => 
    m.role.toLowerCase().includes('house officer') || 
    m.role.toLowerCase().includes('intern')
  );
  const others = team.filter(m => 
    !residents.includes(m) && !houseOfficers.includes(m)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold">Patient Preparation Team</h1>
        <p className="text-gray-400 mt-2">
          {team.length} team member(s) involved in patient preparation
        </p>
      </div>

      {/* Residents */}
      {residents.length > 0 && (
        <TeamSection title="Residents / Registrars" members={residents} color="blue" />
      )}

      {/* House Officers */}
      {houseOfficers.length > 0 && (
        <TeamSection title="House Officers / Interns" members={houseOfficers} color="green" />
      )}

      {/* Others */}
      {others.length > 0 && (
        <TeamSection title="Other Team Members" members={others} color="purple" />
      )}

      {/* Acknowledgment Footer */}
      <div className="text-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/30 rounded-xl p-6">
        <Award className="h-10 w-10 text-indigo-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-indigo-300">Team Acknowledgment</h3>
        <p className="text-gray-400 mt-2">
          The above team members have contributed to preparing this patient for surgery.
          Their work includes patient workup, investigations, consent, and pre-operative optimization.
        </p>
      </div>
    </div>
  );
}

function TeamSection({ 
  title, 
  members, 
  color 
}: { 
  title: string; 
  members: PreparingTeamMember[]; 
  color: 'blue' | 'green' | 'purple' 
}) {
  const colorClasses = {
    blue: 'bg-blue-600/30 border-blue-500/30 text-blue-300',
    green: 'bg-green-600/30 border-green-500/30 text-green-300',
    purple: 'bg-purple-600/30 border-purple-500/30 text-purple-300',
  };

  const avatarColors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-2xl overflow-hidden`}>
      <div className="bg-black/20 px-6 py-3 border-b border-white/10">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-gray-400">{members.length} member(s)</p>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map((member) => (
          <TeamMemberCard key={member.id} member={member} avatarColor={avatarColors[color]} />
        ))}
      </div>
    </div>
  );
}

function TeamMemberCard({ 
  member, 
  avatarColor 
}: { 
  member: PreparingTeamMember; 
  avatarColor: string 
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <div className="flex items-start space-x-4">
        <div className={`w-12 h-12 ${avatarColor} rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0`}>
          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-lg truncate">{member.name}</h4>
          <p className="text-sm text-gray-400">{member.role}</p>
          
          {member.preparation_date && (
            <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(member.preparation_date).toLocaleDateString()}</span>
            </div>
          )}
          
          {member.tasks_completed && member.tasks_completed.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Tasks Completed:</p>
              <div className="flex flex-wrap gap-1">
                {member.tasks_completed.map((task, i) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center space-x-1 bg-white/10 px-2 py-0.5 rounded text-xs"
                  >
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span>{task}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
