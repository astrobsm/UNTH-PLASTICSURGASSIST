/**
 * The training surfaces must stay merged.
 *
 * There were three screens doing one job — Medical Training, Admin -> Students
 * and Training Admin — plus two orphaned copies of the same CME and MCQ
 * material at /education and /mcq-education that were routed but missing from
 * the sidebar, and two different CMEArticleViewer components.
 *
 * These tests fail if any of that comes back.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));

describe('superseded modules stay deleted', () => {
  it.each([
    'src/pages/Education.tsx',
    'src/pages/MCQEducation.tsx',
    'src/components/CMEArticleViewer.tsx', // the duplicate; training/ keeps the real one
    'src/services/cmeService.ts',
  ])('%s is gone', (file) => {
    expect(exists(file)).toBe(false);
  });

  it('leaves exactly one CME article viewer', () => {
    expect(exists('src/components/training/CMEArticleViewer.tsx')).toBe(true);
    expect(exists('src/components/CMEArticleViewer.tsx')).toBe(false);
  });

  it('nothing still imports them', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(entry.name)) {
          const src = read(rel);
          if (/from '.*pages\/(Education|MCQEducation)'/.test(src)
            || /from '.*\.\.\/components\/CMEArticleViewer'/.test(src)
            || /from '.*services\/cmeService'/.test(src)) {
            offenders.push(rel);
          }
        }
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });
});

describe('routing', () => {
  const app = read('src/App.tsx');

  it('serves the learning material at exactly one path', () => {
    // /training renders the module; the old paths redirect to it.
    expect(app).toMatch(/path="\/training" element=\{<MedicalTrainingPage \/>\}/);
    for (const legacy of ['/medical-training', '/education', '/mcq-education']) {
      const rendered = new RegExp(`path="${legacy}" element=\\{<(?!Navigate)`);
      expect(app, `${legacy} should redirect, not render`).not.toMatch(rendered);
    }
  });

  it('keeps every superseded path reachable rather than 404', () => {
    for (const legacy of ['/medical-training', '/education', '/mcq-education', '/admin-training']) {
      expect(app, `${legacy} has no redirect`).toContain(`path="${legacy}"`);
    }
  });

  it('lets a student reach the training module', () => {
    // The student shell has its own <Routes>; the module must be inside it,
    // or the catch-all sends them back to their dashboard and the material
    // they are scored on is unreachable.
    const studentShell = app.slice(
      app.indexOf("if ((user.role as string) === 'student')"),
      app.indexOf('const isApproved'),
    );
    expect(studentShell).toContain('path="/training"');
  });
});

describe('the sidebar points at the merged screens', () => {
  const layout = read('src/components/Layout.tsx');

  it('has one training entry and one training-admin entry', () => {
    expect(layout).toContain("href: '/training'");
    expect(layout).toContain("href: '/training-admin'");
  });

  it('no longer sends admins to a separate Students screen', () => {
    expect(layout).not.toContain("/admin?tab=students");
  });
});

describe('student management has one implementation', () => {
  it('lives in components/training and is used by Training Admin', () => {
    expect(exists('src/components/training/StudentManagementPanels.tsx')).toBe(true);
    const adminTraining = read('src/pages/AdminTrainingPage.tsx');
    expect(adminTraining).toContain('StudentManagementPanels');
    expect(adminTraining).toContain('StudentManagementTab');
    expect(adminTraining).toContain('StudentGroupsPanel');
  });

  it('is no longer declared inside Admin.tsx', () => {
    const admin = read('src/pages/Admin.tsx');
    expect(admin).not.toMatch(/function StudentManagementTab\s*\(/);
    expect(admin).not.toMatch(/function StudentGroupsPanel\s*\(/);
  });

  it('forwards the old Admin students tab', () => {
    expect(read('src/pages/Admin.tsx')).toContain('/training-admin?tab=students');
  });
});

describe('the CBT screen does not cover its own controls', () => {
  const exam = read('src/components/cbt/CBTExamInterface.tsx');

  it('keeps the attention indicator out of the content area', () => {
    // It used to sit at `absolute top-16 right-4`, on top of the
    // Flag-for-review button and the phone question navigator.
    expect(exam).not.toContain('absolute top-16 right-4');
  });

  it('never renders a blank answer option', () => {
    // Questions imported from the CME articles carry four options, not five.
    expect(exam).toContain("question.options[option]?.trim() ?");
  });

  it('keeps the anti-cheat overlays click-through', () => {
    const watermark = exam.slice(exam.indexOf('.cbt-exam-watermark'), exam.indexOf('@keyframes cbt-watermark-shift'));
    const moire = exam.slice(exam.indexOf('.cbt-moire-overlay'));
    expect(watermark).toContain('pointer-events: none');
    expect(moire.slice(0, 400)).toContain('pointer-events: none');
  });
});
