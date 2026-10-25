import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Lesson, LessonBlock, VocabularyItem, LessonSnapshot, TutorSettings } from '../types';

// Helper to generate ink-friendly printable lesson handout
export function generateLessonHandoutPdf(
  lesson: Lesson,
  studentName: string,
  cefrLevel: string,
  vocabItems: VocabularyItem[],
  settings?: TutorSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: settings?.paperSize === 'letter' ? 'letter' : 'a4',
  });

  const primaryAccent = [250, 204, 21]; // #FACC15
  const darkText = [20, 20, 24];
  const mutedText = [100, 100, 110];

  // 1. Header Bar with thin yellow accent line
  doc.setFillColor(250, 204, 21);
  doc.rect(14, 12, 182, 2, 'F');

  // Title & Tutor Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text(lesson.title || 'Fiche Pédagogique de Cours', 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(
    `Élève : ${studentName}  |  Niveau : ${cefrLevel}  |  Durée : ${lesson.classLength} min  |  Date : ${new Date().toLocaleDateString('fr-FR')}`,
    14,
    28
  );

  let currentY = 36;

  // 2. Blocks
  lesson.blocks.forEach((block) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Block header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text(`${block.title} (${block.minutes} min)`, 14, currentY);

    // Accent line under block header
    doc.setDrawColor(primaryAccent[0], primaryAccent[1], primaryAccent[2]);
    doc.setLineWidth(0.5);
    doc.line(14, currentY + 1.5, 80, currentY + 1.5);

    currentY += 7;

    // Block content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(50, 50, 55);

    const splitContent = doc.splitTextToSize(block.content || 'Contenu à aborder pendant la séance.', 180);
    doc.text(splitContent, 14, currentY);

    currentY += splitContent.length * 5 + 7;
  });

  // 3. Vocabulary Table (if any)
  if (vocabItems.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Vocabulaire Clé & Répétition Espacée', 14, currentY);
    currentY += 4;

    const tableRows = vocabItems.map((v) => [v.french, v.english, v.exampleSentence]);

    (doc as any).autoTable({
      startY: currentY,
      head: [['Français', 'Anglais', 'Exemple en contexte']],
      body: tableRows,
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 247],
        textColor: [20, 20, 24],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [40, 40, 45],
      },
      styles: {
        cellPadding: 2.5,
        lineColor: [220, 220, 225],
        lineWidth: 0.2,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // 4. Homework Box
  if (lesson.homework && lesson.homework.text.trim().length > 0) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.roundedRect(14, currentY, 182, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Devoirs pour la prochaine séance :', 18, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 65);
    doc.text(lesson.homework.text, 18, currentY + 14);
  }

  // Footer Branding
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(
      `${settings?.tutorName || 'ProfPlan'} • Fiche de cours personnalisée • Page ${i} sur ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`${studentName.replace(/\s+/g, '_')}_Fiche_Cours_${lesson.classLength}min.pdf`);
}

// Generate printable Flashcards (PRD Section 3.4: "Flashcards built on the device, print offline")
export function generateFlashcardsPdf(
  studentName: string,
  vocabItems: VocabularyItem[],
  settings?: TutorSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: settings?.paperSize === 'letter' ? 'letter' : 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Grid layout: 2 columns x 4 rows = 8 cards per page
  const cols = 2;
  const rows = 4;
  const marginX = 12;
  const marginY = 16;
  const cardWidth = (pageWidth - marginX * 2 - 6) / cols; // ~88 mm
  const cardHeight = (pageHeight - marginY * 2 - 12) / rows; // ~60 mm

  let cardIndex = 0;

  vocabItems.forEach((item, index) => {
    const pageCardIndex = index % 8;
    if (index > 0 && pageCardIndex === 0) {
      doc.addPage();
    }

    const col = pageCardIndex % cols;
    const row = Math.floor(pageCardIndex / cols);

    const x = marginX + col * (cardWidth + 6);
    const y = marginY + row * (cardHeight + 4);

    // Card boundary (dashed guideline for easy cut out)
    doc.setDrawColor(210, 210, 215);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 2], 0);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'D');
    doc.setLineDashPattern([], 0);

    // Yellow top accent tab
    doc.setFillColor(250, 204, 21);
    doc.rect(x + 4, y, 20, 1.5, 'F');

    // Leitner Box badge
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 140);
    doc.text(`Boîte Leitner : ${item.box}/5`, x + cardWidth - 25, y + 6);

    // Target French Word / Expression (Bold center)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 24);
    const splitFrench = doc.splitTextToSize(item.french, cardWidth - 10);
    doc.text(splitFrench, x + 6, y + 15);

    const afterFrenchY = y + 15 + splitFrench.length * 5;

    // English translation
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 80);
    const splitEnglish = doc.splitTextToSize(item.english, cardWidth - 10);
    doc.text(splitEnglish, x + 6, afterFrenchY + 2);

    const afterEnglishY = afterFrenchY + 2 + splitEnglish.length * 4.5;

    // Example in context (if present)
    if (item.exampleSentence && afterEnglishY < y + cardHeight - 8) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 110);
      const splitExample = doc.splitTextToSize(`« ${item.exampleSentence} »`, cardWidth - 12);
      doc.text(splitExample, x + 6, afterEnglishY + 3);
    }
  });

  // Footer on each page
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 170);
    doc.text(
      `${settings?.tutorName || 'ProfPlan'} • Flashcards Vocabulaire : ${studentName} • Page ${i}/${pageCount}`,
      14,
      pageHeight - 6
    );
  }

  doc.save(`${studentName.replace(/\s+/g, '_')}_Flashcards_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Generate printable vocabulary sheet
export function generateVocabListPdf(
  studentName: string,
  vocabItems: VocabularyItem[],
  periodLabel: string,
  settings?: TutorSettings
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: settings?.paperSize === 'letter' ? 'letter' : 'a4',
  });

  const darkText = [20, 20, 24];
  const mutedText = [100, 100, 110];

  // Header accent bar
  doc.setFillColor(250, 204, 21);
  doc.rect(14, 12, 182, 2.5, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text('Répertoire & Lexique de Vocabulaire FLE', 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(`Élève : ${studentName}  |  Période : ${periodLabel}  |  Total mots : ${vocabItems.length}`, 14, 28);

  const tableRows = vocabItems.map((v) => [
    v.french,
    v.english,
    v.exampleSentence || '—',
    `Boîte ${v.box} (${v.status})`,
  ]);

  (doc as any).autoTable({
    startY: 34,
    head: [['Mot / Expression', 'Traduction', 'Exemple en Contexte', 'Répétition Leitner']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 247],
      textColor: [20, 20, 24],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [40, 40, 45],
    },
    styles: {
      cellPadding: 3,
      lineColor: [220, 220, 225],
      lineWidth: 0.2,
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${studentName.replace(/\s+/g, '_')}_Vocabulaire_${periodLabel.replace(/\s+/g, '_')}.pdf`);
}

// Generate Monthly / Quarterly / All-Students Report
export function generateReportPdf(
  reportTitle: string,
  periodLabel: string,
  studentName: string,
  cefrLevel: string,
  metrics: { classesCount: number; totalHours: number; wordsMastered: number },
  topicsCovered: string[],
  tutorComment: string,
  shareableNotes: string,
  settings?: TutorSettings,
  quarterlyBreakdown?: {
    months: Array<{ name: string; classes: number; hours: number }>;
    attendance: { held: number; cancelled: number; noShow: number };
    startCefr: string;
    endCefr: string;
    quarterlyGoals: string;
  },
  allStudentsSummary?: Array<{
    name: string;
    cefr: string;
    classes: number;
    hours: number;
    wordsIntroduced: number;
  }>
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: settings?.paperSize === 'letter' ? 'letter' : 'a4',
  });

  const darkText = [20, 20, 24];
  const mutedText = [100, 100, 110];

  // Header accent bar
  doc.setFillColor(250, 204, 21);
  doc.rect(14, 12, 182, 2.5, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text(reportTitle, 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(
    `Élève : ${studentName}  |  Niveau : ${cefrLevel}  |  Période : ${periodLabel}`,
    14,
    28
  );

  let currentY = 36;

  // Case 1: All Students Summary Report (PRD Section 3.4)
  if (allStudentsSummary && allStudentsSummary.length > 0) {
    const tableRows = allStudentsSummary.map((s) => [
      s.name,
      s.cefr,
      `${s.classes}`,
      `${s.hours.toFixed(1)} h`,
      `${s.wordsIntroduced}`,
    ]);

    // Total row
    const totalClasses = allStudentsSummary.reduce((acc, s) => acc + s.classes, 0);
    const totalHours = allStudentsSummary.reduce((acc, s) => acc + s.hours, 0);
    const totalWords = allStudentsSummary.reduce((acc, s) => acc + s.wordsIntroduced, 0);

    tableRows.push(['TOTAL GÉNÉRAL', '—', `${totalClasses}`, `${totalHours.toFixed(1)} h`, `${totalWords}`]);

    (doc as any).autoTable({
      startY: currentY,
      head: [['Nom de l’Élève', 'Niveau CECRL', 'Séances Données', 'Volume Horaire', 'Nouveaux Mots']],
      body: tableRows,
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 247],
        textColor: [20, 20, 24],
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [40, 40, 45],
      },
      styles: {
        cellPadding: 3.5,
        lineColor: [220, 220, 225],
        lineWidth: 0.2,
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Synthese_Tous_Eleves_${periodLabel.replace(/\s+/g, '_')}.pdf`);
    return;
  }

  // Stat summary boxes
  doc.setFillColor(248, 248, 250);
  doc.setDrawColor(220, 220, 225);
  doc.roundedRect(14, currentY, 56, 20, 2, 2, 'FD');
  doc.roundedRect(77, currentY, 56, 20, 2, 2, 'FD');
  doc.roundedRect(140, currentY, 56, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text(`${metrics.classesCount}`, 18, currentY + 10);
  doc.text(`${metrics.totalHours.toFixed(1)} h`, 81, currentY + 10);
  doc.text(`${metrics.wordsMastered}`, 144, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Séances dispensées', 18, currentY + 16);
  doc.text('Volume horaire total', 81, currentY + 16);
  doc.text('Mots acquis / révisés', 144, currentY + 16);

  currentY += 28;

  // Case 2: Quarterly Breakdown (PRD Section 3.4)
  if (quarterlyBreakdown) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Évolution Trimestrielle & Assiduité :', 14, currentY);
    currentY += 5;

    const breakdownRows = quarterlyBreakdown.months.map((m) => [m.name, `${m.classes} cours`, `${m.hours.toFixed(1)} h`]);
    (doc as any).autoTable({
      startY: currentY,
      head: [['Mois', 'Cours Dispensés', 'Volume Horaire']],
      body: breakdownRows,
      theme: 'plain',
      headStyles: { fillColor: [245, 245, 247], textColor: [20, 20, 24], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [40, 40, 45] },
      styles: { cellPadding: 2.5, lineColor: [220, 220, 225], lineWidth: 0.2 },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // Progression CECRL & Attendance
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 55);
    doc.text(
      `Progression CECRL : Début ${quarterlyBreakdown.startCefr}  ->  Fin ${quarterlyBreakdown.endCefr}   |   Assiduité : ${quarterlyBreakdown.attendance.held} tenus, ${quarterlyBreakdown.attendance.cancelled} annulés, ${quarterlyBreakdown.attendance.noShow} absences`,
      14,
      currentY
    );
    currentY += 8;
  }

  // Topics covered section
  if (topicsCovered.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Thématiques & Objectifs Travaillés :', 14, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 55);

    topicsCovered.forEach((topic) => {
      doc.text(`• ${topic}`, 18, currentY);
      currentY += 5;
    });
    currentY += 4;
  }

  // Tutor Written Comment
  if (tutorComment.trim().length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Bilan & Observations Pédagogiques du Tuteur :', 14, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 55);
    const splitComment = doc.splitTextToSize(tutorComment, 180);
    doc.text(splitComment, 14, currentY);
    currentY += splitComment.length * 4.5 + 6;
  }

  // Shareable Notes (Parent-facing: strictly shareable only)
  if (shareableNotes.trim().length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text('Points Forts & Conseils pour la suite :', 14, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 55);
    const splitNotes = doc.splitTextToSize(shareableNotes, 180);
    doc.text(splitNotes, 14, currentY);
  }

  // Footer Branding
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 160);
  doc.text(
    `${settings?.tutorName || 'ProfPlan'} • Bilan Pédagogique Officiel • Preply French Tutoring`,
    14,
    doc.internal.pageSize.getHeight() - 8
  );

  doc.save(`${studentName.replace(/\s+/g, '_')}_Bilan_${periodLabel.replace(/\s+/g, '_')}.pdf`);
}
