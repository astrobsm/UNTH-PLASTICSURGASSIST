<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Plastic Surgeon Assistant PWA

This is a Progressive Web App (PWA) for plastic surgery clinical workflows, designed for interns and resident doctors.

## Project Overview
- **Tech Stack**: React + TypeScript + Tailwind CSS + PWA
- **Backend**: Node.js/NestJS + PostgreSQL 
- **Features**: Patient management, treatment plans, checklists, prescriptions, wound care protocols, lab orders, education modules
- **Color Palette**: Green (#0E9F6E) for clinical/trust, Red (#DC2626) for alerts
- **Security**: Role-based access, HIPAA compliance considerations
- **Offline**: Service worker with IndexedDB for offline-first functionality

## Development Guidelines
- Use TypeScript for all code
- Follow medical software best practices for security and data handling
- Implement proper role-based access control (RBAC)
- Ensure WCAG AA accessibility compliance
- Use the green/red color palette consistently
- Implement audit logging for all clinical actions
- Follow offline-first PWA patterns

## Key Clinical Workflows
1. Patient record management
2. Treatment plan creation and tracking
3. Safety checklists (WHO-style)
4. Prescription management
5. Wound care protocols
6. Surgical consumables management
7. Lab ordering and results
8. Educational content and assessments

## User Roles
- Admin (System Administrator)
- Consultant (Attending Surgeon)
- Senior Registrar
- Junior Registrar
- House Officer