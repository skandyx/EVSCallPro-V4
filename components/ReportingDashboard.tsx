import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Feature, CallHistoryRecord, User, Campaign, Qualification, AgentSession } from '../types.ts';
import { ArrowUpTrayIcon, TimeIcon, PhoneIcon, ChartBarIcon, XMarkIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

// Déclaration pour TypeScript afin de reconnaître les variables globales injectées par les scripts CDN
declare var jspdf: any;
declare var Chart: any;
declare var d3: any;

interface ReportingDashboardProps {
    feature: Feature;
    callHistory: CallHistoryRecord[];
    agentSessions: AgentSession[];
    users: User[];
    campaigns: Campaign[];
    qualifications: Qualification[];
}

const getStartDate = (range: string): Date => {
    const now = new Date();
    if (range === 'last7days') {
        now.setDate(now.getDate() - 7);
    } else if (range === 'last30days') {
        now.setDate(now.getDate() - 30);
    } else if (range === 'thismonth') {
        now.setDate(1);
    }
    now.setHours(0, 0, 0, 0);
    return now;
};

const formatDuration = (seconds: number, type: 'full' | 'short' = 'short') => {
    if(isNaN(seconds) || seconds < 0) return type === 'full' ? '0h 0m 0s' : '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if(type === 'full') return `${h}h ${m}m ${s}s`;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

type ReportTab = 'timesheet' | 'campaign' | 'agent' | 'history' | 'charts';

const ChartComponent: React.FC<{ type: string; data: any; options: any; }> = ({ type, data, options }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartRef.current = new Chart(ctx, {
                    type,
                    data,
                    options,
                });
            }
        }

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [type, data, options]);

    return <canvas ref={canvasRef}></canvas>;
};

const TREEMAP_COLORS = [
  '#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6', '#fbbf24', '#34d399', '#f87171', '#a78bfa',
  '#60a5fa', '#fcd34d', '#6ee7b7', '#fca5a5', '#c4b5fd', '#1d4ed8', '#d97706', '#059669', '#dc2626', '#7c3aed'
];

const ReportingDashboard: React.FC<ReportingDashboardProps> = ({ feature, callHistory, agentSessions, users, campaigns, qualifications }) => {
    
    const [activeTab, setActiveTab] = useState<ReportTab>('charts');
    const [filters, setFilters] = useState({
        dateRange: 'last7days',
        startDate: getStartDate('last7days').toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        campaignId: 'all',
        agentId: 'all',
    });
    const [treemapFilter, setTreemapFilter] = useState<{ type: Qualification['type'] | null, qualificationId: string | null }>({ type: null, qualificationId: null });
    const { t } = useI18n();

    const findEntityName = (id: string | null, collection: Array<{id: string, name?: string, firstName?: string, lastName?: string, description?: string}>, returnString: boolean = false): string | React.ReactNode => {
        if (!id) return returnString ? t('common.notAvailable') : <span className="text-slate-400 italic">{t('common.notAvailable')}</span>;
        const item = collection.find(i => i.id === id);
        if (!item) return returnString ? t('common.unknown') : <span className="text-red-500">{t('common.unknown')}</span>;
        const name = item.name || `${item.firstName} ${item.lastName}` || item.description;
        return returnString ? (name || '') : <>{name || ''}</>;
    };
    
    const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const range = e.target.value;
        setFilters(f => ({
            ...f,
            dateRange: range,
            startDate: getStartDate(range).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
        }));
    };
    
    const dateFilteredData = useMemo(() => {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        
        const calls = callHistory.filter(call => {
            const callDate = new Date(call.timestamp);
            return callDate >= start && callDate <= end;
        });

        const sessions = agentSessions.filter(session => {
             const sessionDate = new Date(session.loginTime);
             return sessionDate >= start && sessionDate <= end;
        });

        return { calls, sessions };
    }, [callHistory, agentSessions, filters.startDate, filters.endDate]);

    const filteredHistory = useMemo(() => {
        return dateFilteredData.calls.filter(call => {
            if (filters.campaignId !== 'all' && call.campaignId !== filters.campaignId) return false;
            if (filters.agentId !== 'all' && call.agentId !== filters.agentId) return false;
            return true;
        });
    }, [dateFilteredData.calls, filters.campaignId, filters.agentId]);
    
    const filteredDataForTables = useMemo(() => {
        if (!treemapFilter.type && !treemapFilter.qualificationId) {
            return filteredHistory;
        }
        return filteredHistory.filter(call => {
            if (!call.qualificationId) return false;
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if (!qual) return false;

            // Si un ID de qualif est sélectionné, c'est le filtre le plus précis
            if (treemapFilter.qualificationId) {
                return qual.id === treemapFilter.qualificationId;
            }
            // Sinon, filtrer par type
            if (treemapFilter.type) {
                return qual.type === treemapFilter.type;
            }
            return true;
        });
    }, [filteredHistory, treemapFilter, qualifications]);

    const kpis = useMemo(() => {
        const totalCalls = filteredHistory.length;
        const totalDuration = filteredHistory.reduce((acc, call) => acc + call.duration, 0);
        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
        const positiveQuals = filteredHistory.filter(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            return qual?.type === 'positive';
        }).length;
        const successRate = totalCalls > 0 ? (positiveQuals / totalCalls) * 100 : 0;
        
        const totalAgentTime = users.filter(u => u.role === 'Agent').length * 8 * 3600;
        const occupancy = totalAgentTime > 0 ? (totalDuration / totalAgentTime) * 100 : 0;

        return { totalCalls, totalDuration, avgDuration, successRate, occupancy };
    }, [filteredHistory, qualifications, users]);
    
    const campaignReportData = useMemo(() => {
        const report: { [key: string]: { name: string, calls: number, totalDuration: number, success: number } } = {};
        filteredDataForTables.forEach(call => {
            if (!call.campaignId) return;
            if (!report[call.campaignId]) {
                report[call.campaignId] = { name: findEntityName(call.campaignId, campaigns, true) as string, calls: 0, totalDuration: 0, success: 0 };
            }
            report[call.campaignId].calls++;
            report[call.campaignId].totalDuration += call.duration;
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if(qual?.type === 'positive') report[call.campaignId].success++;
        });
        return Object.values(report);
    }, [filteredDataForTables, campaigns, qualifications, findEntityName]);

     const agentReportData = useMemo(() => {
        const report: { [key: string]: { name: string, calls: number, totalDuration: number, success: number } } = {};
        filteredDataForTables.forEach(call => {
            if (!report[call.agentId]) {
                report[call.agentId] = { name: findEntityName(call.agentId, users, true) as string, calls: 0, totalDuration: 0, success: 0 };
            }
            report[call.agentId].calls++;
            report[call.agentId].totalDuration += call.duration;
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if(qual?.type === 'positive') report[call.agentId].success++;
        });
        return Object.values(report);
    }, [filteredDataForTables, users, qualifications, findEntityName]);
    
    const timesheetReportData = useMemo(() => {
        const dailyData: { [key: string]: { [key: string]: AgentSession[] } } = {};

        dateFilteredData.sessions
            .filter(session => filters.agentId === 'all' || session.agentId === filters.agentId)
            .forEach(session => {
                const date = new Date(session.loginTime).toISOString().split('T')[0];
                if (!dailyData[date]) dailyData[date] = {};
                if (!dailyData[date][session.agentId]) dailyData[date][session.agentId] = [];
                dailyData[date][session.agentId].push(session);
            });

        const report: { date: string, agentName: string, firstLogin: string, lastLogout: string, totalDuration: number, adherence: number }[] = [];
        const plannedStartTime = 9 * 3600 + 0 * 60; // 9:00 AM in seconds

        Object.entries(dailyData).forEach(([dateString, agentSessionsByDate]) => {
            Object.entries(agentSessionsByDate).forEach(([agentId, sessions]) => {
                if (sessions.length === 0) return;
                
                sessions.sort((a, b) => new Date(a.loginTime).getTime() - new Date(b.loginTime).getTime());
                
                const firstLoginDate = new Date(sessions[0].loginTime);
                const lastLogoutDate = new Date(sessions[sessions.length - 1].logoutTime);
                
                const totalDuration = sessions.reduce((acc, s) => acc + (new Date(s.logoutTime).getTime() - new Date(s.loginTime).getTime()) / 1000, 0);
                
                const firstLoginSeconds = firstLoginDate.getHours() * 3600 + firstLoginDate.getMinutes() * 60 + firstLoginDate.getSeconds();
                const adherence = (firstLoginSeconds - plannedStartTime) / 60; // in minutes

                report.push({
                    date: new Date(dateString).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                    agentName: findEntityName(agentId, users, true) as string,
                    firstLogin: firstLoginDate.toLocaleTimeString('fr-FR'),
                    lastLogout: lastLogoutDate.toLocaleTimeString('fr-FR'),
                    totalDuration,
                    adherence
                });
            });
        });
        
        return report.sort((a,b) => new Date(b.date.split(' ').slice(1).join(' ')).getTime() - new Date(a.date.split(' ').slice(1).join(' ')).getTime() || a.agentName.localeCompare(b.agentName));

    }, [dateFilteredData.sessions, users, filters.agentId, findEntityName]);
    
    const agentTimesheetSummary = useMemo(() => {
        const summary: { [key: string]: { name: string, totalDuration: number, totalAdherence: number, count: number } } = {};
        timesheetReportData.forEach(entry => {
            const agentId = users.find(u => u.firstName + ' ' + u.lastName === entry.agentName)?.id;
            if (!agentId) return;

            if (!summary[agentId]) {
                summary[agentId] = { name: entry.agentName, totalDuration: 0, totalAdherence: 0, count: 0 };
            }
            summary[agentId].totalDuration += entry.totalDuration;
            summary[agentId].totalAdherence += entry.adherence;
            summary[agentId].count++;
        });
        return Object.values(summary);
    }, [timesheetReportData, users]);

    const qualificationPerformanceForChart = useMemo(() => {
        const campaignQuals = qualifications.filter(q => q.isStandard || campaigns.some(c => c.qualificationGroupId === q.groupId));
        const qualCounts = filteredHistory.reduce((acc, call) => {
            if (call.qualificationId) {
                acc[call.qualificationId] = (acc[call.qualificationId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return campaignQuals.map(qual => ({
            ...qual,
            count: qualCounts[qual.id] || 0,
        }));
    }, [qualifications, filteredHistory, campaigns]);

    const qualificationPerformanceForTable = useMemo(() => {
        const campaignQuals = qualifications.filter(q => q.isStandard || campaigns.some(c => c.qualificationGroupId === q.groupId));
        const qualCounts = filteredDataForTables.reduce((acc, call) => {
            if (call.qualificationId) {
                acc[call.qualificationId] = (acc[call.qualificationId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return campaignQuals.map(qual => {
            const count = qualCounts[qual.id] || 0;
            const rate = filteredDataForTables.length > 0 ? (count / filteredDataForTables.length) * 100 : 0;
            return {
                ...qual,
                count,
                rate,
            };
        }).filter(q => q.count > 0).sort((a,b) => b.count - a.count);
    }, [qualifications, filteredDataForTables, campaigns]);

    // Data for charts
    const dailyVolumeData = useMemo(() => {
        const counts: { [date: string]: number } = {};
        filteredDataForTables.forEach(call => {
            const date = new Date(call.timestamp).toLocaleDateString('fr-FR');
            counts[date] = (counts[date] || 0) + 1;
        });
        const labels = Object.keys(counts).sort((a, b) => new Date(a.split('/').reverse().join('-')).getTime() - new Date(b.split('/').reverse().join('-')).getTime());
        const data = labels.map(label => counts[label]);
        return {
            labels,
            datasets: [{
                label: t('reporting.charts.callCountLabel'),
                data,
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1
            }]
        };
    }, [filteredDataForTables, t]);

    const successRateByAgentData = useMemo(() => {
        return {
            labels: agentReportData.map(a => a.name),
            datasets: [{
                label: t('reporting.charts.successRateLabel'),
                data: agentReportData.map(a => a.calls > 0 ? (a.success / a.calls * 100) : 0),
                backgroundColor: 'rgba(22, 163, 74, 0.7)',
            }]
        };
    }, [agentReportData, t]);

    const adherenceByAgentData = useMemo(() => {
        return {
            labels: agentTimesheetSummary.map(a => a.name),
            datasets: [{
                label: t('reporting.charts.avgAdherenceLabel'),
                data: agentTimesheetSummary.map(a => a.count > 0 ? (a.totalAdherence / a.count) : 0),
                backgroundColor: 'rgba(249, 115, 22, 0.7)',
            }]
        };
    }, [agentTimesheetSummary, t]);

    const qualColorMap = useMemo(() => {
        const map = new Map();
        qualifications.forEach((qual, index) => {
            map.set(qual.id, TREEMAP_COLORS[index % TREEMAP_COLORS.length]);
        });
        return map;
    }, [qualifications]);

    const treemapChartData = useMemo(() => ({
        datasets: [{
            tree: qualificationPerformanceForChart.filter(q => q.count > 0),
            key: 'count',
            groups: ['type', 'description'],
            spacing: 1,
            borderWidth: 2,
            borderColor: 'white',
            captions: {
                display: true,
                color: 'white',
                font: { weight: 'bold' }
            },
            labels: {
                display: false
            },
        }]
    }), [qualificationPerformanceForChart]);

    const treemapOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const node = context.raw?._data;
                        if (!node) return '';
                        if (node.g) { // Group
                            return `${node.g}: ${node.v} appels`;
                        }
                        if (node.s) { // Leaf
                            return `${node.s.description}: ${node.s.count} appels`;
                        }
                        return '';
                    }
                }
            },
            treemap: {
                colorizer: (ctx: any) => {
                    if (!ctx.raw || !ctx.raw._data) return 'rgba(200, 200, 200, 0.5)';
                    const node = ctx.raw._data;
                    if (node.s && node.s.id && qualColorMap.has(node.s.id)) {
                        return qualColorMap.get(node.s.id);
                    }
                    if (node.g === 'positive') return 'rgba(34, 197, 94, 0.2)';
                    if (node.g === 'negative') return 'rgba(239, 68, 68, 0.2)';
                    if (node.g === 'neutral') return 'rgba(100, 116, 139, 0.2)';
                    return 'rgba(200, 200, 200, 0.5)';
                },
            }
        },
        onClick: (evt: any, elements: any) => {
            if (!elements.length) return;
            const node = elements[0].element.$context.raw._data;
            if (node.g) {
                setTreemapFilter({ type: node.g, qualificationId: null });
            } else if (node.s) {
                setTreemapFilter({ type: node.s.type, qualificationId: node.s.id });
            }
        }
    }), [qualColorMap]);

    const callsByHour = useMemo(() => {
        const hours = Array(24).fill(0);
        filteredDataForTables.forEach(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if (qual?.type === 'positive') {
                const hour = new Date(call.timestamp).getHours();
                hours[hour]++;
            }
        });
        return {
            labels: Array.from({length: 24}, (_, i) => `${i}h`),
            datasets: [{
                label: t('campaignDetail.dashboard.charts.conversionsLabel'),
                data: hours,
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
            }]
        };
    }, [filteredDataForTables, qualifications, t]);


    const handleExportPDF = () => {
        const doc = new jspdf.jsPDF();
        const today = new Date().toLocaleDateString('fr-FR');
        const title = t('reporting.pdf.title');
        
        // --- PAGE 1: SUMMARY ---
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(t('reporting.pdf.period', { startDate: filters.startDate, endDate: filters.endDate, today }), 14, 30);
        
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(t('reporting.pdf.kpiTitle'), 14, 45);

        const kpiBody = [
            [t('reporting.kpis.processedCalls'), kpis.totalCalls.toString()],
            [t('reporting.kpis.totalTalkTime'), formatDuration(kpis.totalDuration, 'full')],
            [t('reporting.kpis.avgCallDuration'), formatDuration(kpis.avgDuration, 'full')],
            [t('reporting.kpis.successRate'), `${kpis.successRate.toFixed(1)}%`],
            [t('reporting.kpis.occupancyRate'), `${kpis.occupancy.toFixed(1)}%`],
        ];
        
        const timesheetSummaryBody = [
            [t('reporting.kpis.activeAgents'), agentTimesheetSummary.length.toString()],
            [t('reporting.kpis.totalLoginTime'), formatDuration(agentTimesheetSummary.reduce((sum, a) => sum + a.totalDuration, 0), 'full')],
            [t('reporting.kpis.avgAdherence'), `${(agentTimesheetSummary.length > 0 ? agentTimesheetSummary.reduce((sum, a) => sum + (a.totalAdherence / a.count), 0) / agentTimesheetSummary.length : 0).toFixed(1)} min`],
        ];

        doc.autoTable({
            startY: 50,
            head: [[t('reporting.pdf.callKpis'), t('reporting.pdf.value')]],
            body: kpiBody,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
        });

        doc.autoTable({
            startY: doc.previousAutoTable.finalY + 10,
            head: [[t('reporting.pdf.timesheetKpis'), t('reporting.pdf.value')]],
            body: timesheetSummaryBody,
            theme: 'striped',
            headStyles: { fillColor: [22, 160, 133] },
        });

        // --- PAGE 2: ANALYSIS ---
        doc.addPage();
        doc.setFontSize(16);
        doc.text(t('reporting.pdf.detailedAnalysis'), 14, 22);
        
        // Campaign Pivot Table
        doc.setFontSize(12);
        doc.text(t('reporting.tables.campaignPerf.title'), 14, 32);
        const campaignTableBody = campaignReportData.map(c => [
            c.name,
            c.calls,
            formatDuration(c.totalDuration, 'full'),
            formatDuration(c.calls > 0 ? c.totalDuration / c.calls : 0, 'full'),
            `${c.calls > 0 ? (c.success / c.calls * 100).toFixed(1) : '0.0'}%`
        ]);
        doc.autoTable({
            startY: 37,
            head: [[t('reporting.tables.campaignPerf.headers.campaign'), t('reporting.tables.campaignPerf.headers.calls'), t('reporting.tables.campaignPerf.headers.totalDuration'), t('reporting.tables.campaignPerf.headers.avgDuration'), t('reporting.tables.campaignPerf.headers.successRate')]],
            body: campaignTableBody,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133] }
        });
        
        // Agent Pivot Table
        doc.setFontSize(12);
        doc.text(t('reporting.tables.agentPerf.titleCalls'), 14, doc.previousAutoTable.finalY + 15);
        const agentCallTableBody = agentReportData.map(a => [
            a.name,
            a.calls,
            formatDuration(a.totalDuration, 'full'),
            formatDuration(a.calls > 0 ? a.totalDuration / a.calls : 0, 'full'),
            `${a.calls > 0 ? (a.success / a.calls * 100).toFixed(1) : '0.0'}%`
        ]);
        doc.autoTable({
            startY: doc.previousAutoTable.finalY + 20,
            head: [[t('reporting.tables.agentPerf.headers.agent'), t('reporting.tables.agentPerf.headers.calls'), t('reporting.tables.agentPerf.headers.totalDuration'), t('reporting.tables.agentPerf.headers.avgDuration'), t('reporting.tables.agentPerf.headers.successRate')]],
            body: agentCallTableBody,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133] }
        });
        
        doc.setFontSize(12);
        doc.text(t('reporting.tables.agentPerf.titleTimesheet'), 14, doc.previousAutoTable.finalY + 15);
         const agentTimeTableBody = agentTimesheetSummary.map(a => [
            a.name,
            a.count,
            formatDuration(a.totalDuration, 'full'),
            `${(a.totalAdherence / a.count).toFixed(1)} min`
        ]);
        doc.autoTable({
            startY: doc.previousAutoTable.finalY + 20,
            head: [[t('reporting.tables.agentPerf.headers.agent'), t('reporting.tables.agentPerf.headers.daysWorked'), t('reporting.tables.agentPerf.headers.totalLoginDuration'), t('reporting.tables.agentPerf.headers.avgAdherence')]],
            body: agentTimeTableBody,
            theme: 'grid',
            headStyles: { fillColor: [22, 160, 133] }
        });

        // --- PAGE 3+: DETAILED LOGS ---
        doc.addPage();
        doc.setFontSize(16);
        doc.text(t('reporting.pdf.detailedLogs'), 14, 22);

        // Timesheet Log
        doc.setFontSize(12);
        doc.text(t('reporting.tables.timesheet.title'), 14, 32);
        const timesheetLogBody = timesheetReportData.map(t => [
            t.date,
            t.agentName,
            t.firstLogin,
            t.lastLogout,
            formatDuration(t.totalDuration, 'full'),
            `${t.adherence.toFixed(0)} min`
        ]);
         doc.autoTable({
            startY: 37,
            head: [[t('reporting.tables.timesheet.headers.date'), t('reporting.tables.timesheet.headers.agent'), t('reporting.tables.timesheet.headers.firstLogin'), t('reporting.tables.timesheet.headers.lastLogout'), t('reporting.tables.timesheet.headers.totalDuration'), t('reporting.tables.timesheet.headers.adherence')]],
            body: timesheetLogBody,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] }
        });

        // Call Log
        if (doc.previousAutoTable.finalY > 250) doc.addPage();
        doc.setFontSize(12);
        doc.text(t('reporting.tables.callHistory.title'), 14, doc.previousAutoTable.finalY + 15);
        const callLogBody = filteredHistory.map(call => [
            new Date(call.timestamp).toLocaleString('fr-FR'),
            findEntityName(call.agentId, users, true),
            findEntityName(call.campaignId, campaigns, true),
            call.callerNumber,
            formatDuration(call.duration),
            findEntityName(call.qualificationId, qualifications, true)
        ]);
        doc.autoTable({
            startY: doc.previousAutoTable.finalY + 20,
            head: [[t('reporting.tables.callHistory.headers.dateTime'), t('reporting.tables.callHistory.headers.agent'), t('reporting.tables.callHistory.headers.campaign'), t('reporting.tables.callHistory.headers.number'), t('reporting.tables.callHistory.headers.duration'), t('reporting.tables.callHistory.headers.qualification')]],
            body: callLogBody,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] }
        });
        
        doc.save(`${t('reporting.pdf.filename')}_${today.replace(/\//g, '-')}.pdf`);
    };

    const renderContent = () => {
        switch(activeTab) {
             case 'charts':
                return (
                    <div className="p-4 space-y-8">
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-slate-800 mb-3">{t('reporting.charts.treemapTitle')}</h3>
                                    {(treemapFilter.type || treemapFilter.qualificationId) && (
                                        <button onClick={() => setTreemapFilter({ type: null, qualificationId: null })} className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1">
                                            <XMarkIcon className="w-4 h-4" /> {t('reporting.charts.resetFilter')}
                                        </button>
                                    )}
                                </div>
                                <div className="h-64"><ChartComponent type="treemap" data={treemapChartData} options={treemapOptions} /></div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <h3 className="font-semibold text-slate-800 mb-3">{t('reporting.charts.successByHourTitle')}</h3>
                                <div className="h-64"><ChartComponent type="bar" data={callsByHour} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} /></div>
                            </div>
                         </div>
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <h3 className="font-semibold text-slate-800 mb-3">{t('reporting.charts.successByAgentTitle')}</h3>
                                <div className="h-64"><ChartComponent type="bar" data={successRateByAgentData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }} /></div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <h3 className="font-semibold text-slate-800 mb-3">{t('reporting.charts.adherenceByAgentTitle')}</h3>
                                <div className="h-64"><ChartComponent type="bar" data={adherenceByAgentData} options={{ responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx: any) => `${ctx.raw.toFixed(1)} min`}}}}} /></div>
                            </div>
                         </div>
                    </div>
                );
             case 'timesheet':
                return (
                     <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50"><tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.timesheet.headers.date')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.timesheet.headers.agent')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.timesheet.headers.firstLogin')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.timesheet.headers.lastLogout')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.timesheet.headers.totalDuration')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.timesheet.headers.adherence')}</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-slate-200 text-sm">
                            {timesheetReportData.map((row, i) => {
                                let adherenceColor = 'text-slate-600';
                                if(row.adherence > 5) adherenceColor = 'text-red-600 font-semibold';
                                if(row.adherence < 0) adherenceColor = 'text-green-600';
                                return (
                                <tr key={i}>
                                    <td className="px-4 py-3 text-slate-600">{row.date}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{row.agentName}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono">{row.firstLogin}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono">{row.lastLogout}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(row.totalDuration, 'full')}</td>
                                    <td className={`px-4 py-3 font-mono ${adherenceColor}`}>
                                        {row.adherence > 0 ? '+' : ''}{row.adherence.toFixed(0)} min
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                );
            case 'campaign':
                return (
                     <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50"><tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.campaignPerf.headers.campaign')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.campaignPerf.headers.calls')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.campaignPerf.headers.totalDuration')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.campaignPerf.headers.avgDuration')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.campaignPerf.headers.successRate')}</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-slate-200 text-sm">
                           {campaignReportData.map((row, i) => (
                               <tr key={i}>
                                   <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                                   <td className="px-4 py-3 text-slate-600">{row.calls}</td>
                                   <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(row.totalDuration, 'full')}</td>
                                   <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(row.calls > 0 ? row.totalDuration / row.calls : 0, 'full')}</td>
                                   <td className="px-4 py-3 text-slate-600">{row.calls > 0 ? (row.success / row.calls * 100).toFixed(1) : '0.0'}%</td>
                               </tr>
                           ))}
                        </tbody>
                    </table>
                );
            case 'agent':
                return (
                     <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50"><tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.agentPerf.headers.agent')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.agentPerf.headers.calls')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.agentPerf.headers.totalDuration')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.agentPerf.headers.avgDuration')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.agentPerf.headers.successRate')}</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-slate-200 text-sm">
                           {agentReportData.map((row, i) => (
                               <tr key={i}>
                                   <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                                   <td className="px-4 py-3 text-slate-600">{row.calls}</td>
                                   <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(row.totalDuration, 'full')}</td>
                                   <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(row.calls > 0 ? row.totalDuration / row.calls : 0, 'full')}</td>
                                   <td className="px-4 py-3 text-slate-600">{row.calls > 0 ? (row.success / row.calls * 100).toFixed(1) : '0.0'}%</td>
                               </tr>
                           ))}
                        </tbody>
                    </table>
                );
            case 'history':
                return (
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50"><tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.callHistory.headers.dateTime')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.callHistory.headers.agent')}</th>
                             <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.callHistory.headers.campaign')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.callHistory.headers.number')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.callHistory.headers.duration')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{t('reporting.tables.callHistory.headers.qualification')}</th>
                        </tr></thead>
                        <tbody className="bg-white divide-y divide-slate-200 text-sm">
                            {filteredHistory.map(call => (
                                <tr key={call.id}>
                                    <td className="px-4 py-3 text-slate-600">{new Date(call.timestamp).toLocaleString('fr-FR')}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{findEntityName(call.agentId, users)}</td>
                                    <td className="px-4 py-3 text-slate-600">{findEntityName(call.campaignId, campaigns)}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono">{call.callerNumber}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(call.duration)}</td>
                                    <td className="px-4 py-3 text-slate-600">{findEntityName(call.qualificationId, qualifications)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
             default: return null;
        }
    }

    return (
         <div className="max-w-7xl mx-auto space-y-6">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{t(feature.titleKey)}</h1>
                    <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
                </div>
                 <button onClick={handleExportPDF} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center">
                    <ArrowUpTrayIcon className="w-5 h-5 mr-2"/>
                    {t('reporting.exportPdf')}
                </button>
            </header>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm font-medium text-slate-600">{t('reporting.filters.dateRange')}</label>
                        <select value={filters.dateRange} onChange={handleDateRangeChange} className="w-full mt-1 p-2 border border-slate-300 rounded-md bg-white">
                            <option value="last7days">{t('reporting.filters.dateRanges.last7days')}</option>
                            <option value="last30days">{t('reporting.filters.dateRanges.last30days')}</option>
                            <option value="thismonth">{t('reporting.filters.dateRanges.thisMonth')}</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                             <label className="text-sm font-medium text-slate-600">{t('reporting.filters.from')}</label>
                            <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} className="w-full mt-1 p-2 border border-slate-300 rounded-md bg-white"/>
                        </div>
                        <div>
                             <label className="text-sm font-medium text-slate-600">{t('reporting.filters.to')}</label>
                            <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} className="w-full mt-1 p-2 border border-slate-300 rounded-md bg-white"/>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-slate-600">{t('reporting.filters.campaign')}</label>
                        <select value={filters.campaignId} onChange={(e) => setFilters(f => ({...f, campaignId: e.target.value}))} className="w-full mt-1 p-2 border border-slate-300 rounded-md bg-white" disabled={activeTab === 'timesheet'}>
                            <option value="all">{t('reporting.filters.allCampaigns')}</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-slate-600">{t('reporting.filters.agent')}</label>
                        <select value={filters.agentId} onChange={(e) => setFilters(f => ({...f, agentId: e.target.value}))} className="w-full mt-1 p-2 border border-slate-300 rounded-md bg-white">
                            <option value="all">{t('reporting.filters.allAgents')}</option>
                            {users.filter(u => u.role === 'Agent').map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KpiCard title={t('reporting.kpis.processedCalls')} value={kpis.totalCalls.toString()} icon={PhoneIcon} />
                <KpiCard title={t('reporting.kpis.totalTalkTime')} value={formatDuration(kpis.totalDuration, 'full')} icon={TimeIcon} />
                <KpiCard title={t('reporting.kpis.avgCallDuration')} value={formatDuration(kpis.avgDuration, 'full')} icon={TimeIcon} />
                <KpiCard title={t('reporting.kpis.successRate')} value={`${kpis.successRate.toFixed(1)}%`} icon={ChartBarIcon} />
                <KpiCard title={t('reporting.kpis.occupancyRate')} value={`${kpis.occupancy.toFixed(1)}%`} icon={ChartBarIcon} />
            </div>

             <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
                        <TabButton text={t('reporting.tabs.charts')} isActive={activeTab === 'charts'} onClick={() => setActiveTab('charts')} />
                        <TabButton text={t('reporting.tabs.timesheet')} isActive={activeTab === 'timesheet'} onClick={() => setActiveTab('timesheet')} />
                        <TabButton text={t('reporting.tabs.campaign')} isActive={activeTab === 'campaign'} onClick={() => setActiveTab('campaign')} />
                        <TabButton text={t('reporting.tabs.agent')} isActive={activeTab === 'agent'} onClick={() => setActiveTab('agent')} />
                        <TabButton text={t('reporting.tabs.history')} isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                    </nav>
                </div>
                 <div className="overflow-x-auto">
                    {renderContent()}
                    {activeTab !== 'timesheet' && activeTab !== 'charts' && filteredHistory.length === 0 && <p className="text-center py-8 text-slate-500">{t('reporting.noCallData')}</p>}
                    {activeTab === 'timesheet' && timesheetReportData.length === 0 && <p className="text-center py-8 text-slate-500">{t('reporting.noSessionData')}</p>}
                </div>
            </div>
        </div>
    );
};

const KpiCard: React.FC<{title: string, value: string, icon: React.FC<any>}> = ({title, value, icon: Icon}) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-md mr-4">
                <Icon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    </div>
);

const TabButton: React.FC<{text: string, isActive: boolean, onClick: () => void}> = ({ text, isActive, onClick }) => (
     <button
        onClick={onClick}
        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
          isActive
            ? 'border-primary text-link'
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
        }`}
    >
        {text}
    </button>
);

export default ReportingDashboard;