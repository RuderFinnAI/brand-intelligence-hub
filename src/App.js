import React, { useState, useEffect, useCallback } from 'react';
import { 
    Search, BrainCircuit, BarChart, Newspaper, ThumbsUp, ThumbsDown, Meh, CheckCircle, 
    KeyRound, Save, Linkedin, Youtube, TrendingUp, TrendingDown, Minus, Building, Users, Briefcase,
    ShieldCheck, RefreshCw, MessageSquareQuote, Telescope, Lightbulb, PenTool, Swords, AtSign
} from 'lucide-react';
import { Chart } from 'chart.js/auto';

// --- UPDATED: Import from our new firebase.js file ---
import { auth, db, onAuthStateChanged, signInAnonymously } from './firebase'; 
import { doc, setDoc, getDoc } from "firebase/firestore";

const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

// Custom Social Icons
const RedditIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor" className="text-orange-500 h-6 w-6 mr-3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-12h2v2h-2v-2zm-2 4c0-1.1.9-2 2-2s2 .9 2 2v2c0 1.1-.9 2-2 2s-2-.9-2-2v-2zm-3.17-2.83c.39-.39 1.02-.39 1.41 0l1.41 1.41c.39.39.39 1.02 0 1.41-.39.39-1.02.39-1.41 0l-1.41-1.41c-.39-.39-.39-1.02 0-1.41zm8.34 0c.39-.39 1.02-.39 1.41 0l1.41 1.41c.39.39.39 1.02 0 1.41-.39.39-1.02.39-1.41 0l-1.41-1.41c-.39-.39-.39-1.02 0-1.41zM12 16c-1.66 0-3-1.34-3-3h6c0 1.66-1.34 3-3 3z"></path></svg> );
const InstagramIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 mr-3 text-pink-500"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> );

const App = () => {
    const [brandName, setBrandName] = useState('Samsung');
    const [refinementQuery, setRefinementQuery] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [apiKey, setApiKey] = useState(process.env.REACT_APP_GEMINI_API_KEY || '');
    const [isKeySaved, setIsKeySaved] = useState(!!process.env.REACT_APP_GEMINI_API_KEY);
    const [isKeyLoading, setIsKeyLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [visibleArticles, setVisibleArticles] = useState(7);
    const [visibleSocial, setVisibleSocial] = useState(7);
    const [currentBrandAnalyzed, setCurrentBrandAnalyzed] = useState('');

    useEffect(() => {
        if (!auth) {
            console.warn("Firebase not initialized. Running in offline mode.");
            setIsKeyLoading(false);
            return;
        };
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                if (!process.env.REACT_APP_GEMINI_API_KEY) {
                    try {
                        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/secrets/api`);
                        const docSnap = await getDoc(userDocRef);
                        if (docSnap.exists() && docSnap.data().key) {
                            setApiKey(docSnap.data().key);
                            setIsKeySaved(true);
                        }
                    } catch (e) { console.error("Error fetching API key:", e); } 
                }
                setIsKeyLoading(false);
            } else {
                signInAnonymously(auth).catch(e => {
                    console.error("Anonymous sign-in error:", e);
                    setIsKeyLoading(false);
                });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSaveApiKey = async () => {
        if (!apiKey || !userId || !db) return;
        setIsLoading(true);
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/secrets/api`);
            await setDoc(userDocRef, { key: apiKey });
            setIsKeySaved(true);
        } catch (e) { setError("Failed to save API key."); setIsKeySaved(false); } 
        finally { setIsLoading(false); }
    };

    const callGeminiAPI = useCallback(async (payload) => {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorBody.error.message}`);
            }
            const result = await response.json();
            const candidate = result.candidates?.[0];
            if (candidate?.finishReason === 'SAFETY') throw new Error("Response blocked for safety reasons.");
            if (candidate?.content?.parts?.[0]?.text) {
                return candidate.content.parts[0].text;
            }
            throw new Error("Invalid response structure from Gemini.");
        } catch (e) {
            console.error("Gemini API call failed:", e);
            throw e;
        }
    }, [apiKey]);

     const handleAnalyze = useCallback(async (brandToAnalyze, refinement) => {
        const currentBrand = brandToAnalyze || brandName;
        if (!currentBrand || !apiKey) {
            setError(!apiKey ? "Please provide an API key." : "Please enter a brand name.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        setVisibleArticles(7);
        setVisibleSocial(7);
        setCurrentBrandAnalyzed(currentBrand);

        const today = new Date();
        const oneYearAgo = new Date(new Date().setFullYear(today.getFullYear() - 1));
        const oneYearAgoDateString = oneYearAgo.toISOString().split('T')[0];
        const refinementText = refinement ? ` The user has requested a deep dive on this specific topic: "${refinement}".` : '';

        try {
            const searchPrompt = `
                Perform targeted web searches for a brand intelligence report on "${currentBrand}", focusing on information since ${oneYearAgoDateString}.${refinementText}
                You MUST find information for every category below:
                1.  **News & Articles:** Find at least 20 recent, relevant news articles.
                2.  **Social Buzz:** Find at least 20 high-engagement or controversial posts about the brand from Reddit, YouTube, Instagram, and LinkedIn.
                3.  **Corporate Data:** Find the official employee count, hiring trend, and a list of C-suite executives.
                4.  **Competitor Landscape:** Identify the top 3 main competitors and find a brief summary of their market position relative to "${currentBrand}".
                5.  **Media Contacts:** Identify 4-5 top-tier journalists or influencers who actively cover this brand AND find the official corporate press contact or newsroom link. For all contacts, you MUST find a relevant URL (e.g., social media profile, newsroom page).
                6.  **Market Data:** Find the official stock name, stock ticker, and a summary of its performance. Also, find 12 months of historical closing price data.
                Return a comprehensive block of text containing all the raw information, including titles, URLs, snippets, and names you have found for each category.
            `;
            const searchPayload = {
                contents: [{ parts: [{ text: searchPrompt }] }],
                tools: [{ "google_search": {} }],
            };
            const searchResultsText = await callGeminiAPI(searchPayload);

            const analysisPrompt = `
                You are a PR intelligence analyst. Based *only* on the following text which contains search results, analyze the brand "${currentBrand}".
                Search Results: """${searchResultsText}"""
                Your final output must be a single, valid JSON object that follows the structure below EXACTLY. Ensure all fields are populated from the search results. Sentiment values must sum to 100.
            `;
            
            const analysisPayload = {
                contents: [{ parts: [{ text: analysisPrompt }] }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            summary: { type: "STRING" },
                            sentiment: { type: "OBJECT", properties: { positive: { type: "OBJECT", properties: { value: { type: "NUMBER" }, summary: { type: "STRING" } } }, negative: { type: "OBJECT", properties: { value: { type: "NUMBER" }, summary: { type: "STRING" } } }, neutral: { type: "OBJECT", properties: { value: { type: "NUMBER" }, summary: { type: "STRING" } } } } },
                            themes: { type: "ARRAY", items: { type: "STRING" } },
                            articles: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, source: { type: "STRING" }, url: { type: "STRING" }, summary: { type: "STRING" } } } },
                            social_discussions: { type: "ARRAY", items: { type: "OBJECT", properties: { platform: { type: "STRING" }, title: { type: "STRING" }, url: { type: "STRING" }, summary: { type: "STRING" } } } },
                            linkedin_snapshot: { type: "OBJECT", properties: { employee_count: { type: "STRING" }, hiring_trend: { type: "STRING", enum: ["increasing", "decreasing", "stable"] }, key_executives: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, title: { type: "STRING" } } } } } },
                            stock_info: { type: "OBJECT", nullable: true, properties: { name: { type: "STRING" }, ticker: { type: "STRING" }, price: { type: "STRING" }, change_percent: { type: "NUMBER" }, summary: { type: "STRING" }, historical_data: { type: "ARRAY", items: { type: "OBJECT", properties: { date: { type: "STRING" }, price: { type: "NUMBER" } } } } } },
                            competitors: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, summary: { type: "STRING" } } } },
                            pr_insights: {
                                type: "OBJECT",
                                properties: {
                                    swot_analysis: { type: "OBJECT", properties: { strengths: { type: "ARRAY", items: { type: "STRING" } }, weaknesses: { type: "ARRAY", items: { type: "STRING" } }, opportunities: { type: "ARRAY", items: { type: "STRING" } }, threats: { type: "ARRAY", items: { type: "STRING" } } } },
                                    key_media_contacts: { type: "OBJECT", properties: {
                                        external: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, outlet: { type: "STRING" }, beat: { type: "STRING" }, url: { type: "STRING" } } } },
                                        internal: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, outlet: { type: "STRING" }, beat: { type: "STRING" }, url: { type: "STRING" } } } }
                                    }},
                                    suggested_story_angles: { type: "ARRAY", items: { type: "STRING" } }
                                }
                            }
                        },
                    }
                }
            };

            const analysisResultText = await callGeminiAPI(analysisPayload);
            const parsedAnalysis = JSON.parse(analysisResultText);
            setAnalysis(parsedAnalysis);

        } catch (e) {
            setError(`Analysis failed. Please try again. Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, brandName, callGeminiAPI]);


    const handleCompetitorClick = (competitorName) => {
        setBrandName(competitorName);
        setRefinementQuery('');
        handleAnalyze(competitorName, '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const StockTrendIcon = ({ trend }) => {
        if (trend > 0) return <TrendingUp className="h-5 w-5 text-green-500" />;
        if (trend < 0) return <TrendingDown className="h-5 w-5 text-red-500" />;
        return <Minus className="h-5 w-5 text-gray-500" />;
    };
    
    const HiringTrendIcon = ({ trend }) => {
        if (trend === 'increasing') return <TrendingUp className="h-5 w-5 text-green-500" />;
        if (trend === 'decreasing') return <TrendingDown className="h-5 w-5 text-red-500" />;
        return <Minus className="h-5 w-5 text-gray-500" />;
    };

    const SentimentBar = ({ positive, negative, neutral }) => (
        <div className="w-full flex rounded-full h-4 bg-gray-200 dark:bg-gray-700 overflow-hidden mb-4">
            <div className="bg-green-500" style={{ width: `${positive}%` }}></div>
            <div className="bg-red-500" style={{ width: `${negative}%` }}></div>
            <div className="bg-gray-400" style={{ width: `${neutral}%` }}></div>
        </div>
    );
    
    const SocialIcon = ({ platform }) => {
        switch (platform.toLowerCase()) {
            case 'reddit': return <RedditIcon />;
            case 'youtube': return <Youtube className="h-6 w-6 text-red-600 mr-3" />;
            case 'instagram': return <InstagramIcon />;
            case 'linkedin': return <Linkedin className="h-6 w-6 text-sky-600 mr-3" />;
            case 'twitter': return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor" className="text-sky-500 h-6 w-6 mr-3"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-.424.727-.666 1.581-.666 2.477 0 1.61.82 3.027 2.053 3.847-.76-.025-1.475-.232-2.104-.577v.062c0 2.248 1.595 4.123 3.713 4.557-.388.106-.798.163-1.226.163-.298 0-.586-.029-.87-.083.588 1.84 2.293 3.178 4.322 3.215-1.582 1.238-3.575 1.975-5.752 1.975-.375 0-.745-.022-1.11-.065 2.042 1.308 4.473 2.07 7.03 2.07 8.427 0 13.02-6.977 13.02-13.021 0-.198-.005-.395-.012-.592.894-.645 1.669-1.449 2.288-2.373z" /></svg>;
            default: return <Users className="h-6 w-6 text-gray-400 mr-3" />;
        }
    };

    const SWOTCard = ({ swot }) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold flex items-center mb-4"><Swords className="h-6 w-6 mr-3 text-indigo-500" />PR SWOT Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2">Strengths</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">{swot.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                <div>
                    <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2">Weaknesses</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">{swot.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
                <div>
                    <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Opportunities</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">{swot.opportunities.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </div>
                <div>
                    <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">Threats</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">{swot.threats.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
            </div>
        </div>
    );
    
    const StockChart = ({ stockInfo }) => {
        const chartRef = React.useRef(null);
        const chartInstance = React.useRef(null);

        useEffect(() => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
            if (chartRef.current && stockInfo?.historical_data) {
                const ctx = chartRef.current.getContext('2d');
                const labels = stockInfo.historical_data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit'}));
                const data = stockInfo.historical_data.map(d => d.price);
                
                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Stock Price',
                            data: data,
                            borderColor: stockInfo.change_percent >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                            backgroundColor: stockInfo.change_percent >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.1
                        }]
                    },
                    options: {
                       responsive: true,
                       maintainAspectRatio: false,
                       plugins: { legend: { display: false } },
                       scales: {
                           x: { ticks: { color: '#9ca3af' } },
                           y: { ticks: { color: '#9ca3af' } }
                       }
                    }
                });
            }
            return () => {
                if (chartInstance.current) {
                    chartInstance.current.destroy();
                }
            };
        }, [stockInfo]);

        if (!stockInfo?.historical_data) return null;

        return (
            <div className="h-64 mt-4">
                 <canvas ref={chartRef}></canvas>
            </div>
        );
    };


    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen font-sans text-gray-800 dark:text-gray-200 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">RF Brand Intelligence Hub</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Powered by Gemini & Firebase</p>
                </header>

                <div className="mb-6 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800/50">
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center"><KeyRound className="h-5 w-5 mr-2"/> Google AI API Key</label>
                    <div className="flex items-center space-x-2">
                        <input type="password" id="apiKey" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setIsKeySaved(false); }} placeholder={isKeyLoading ? "Loading..." : "Paste key here"} className="flex-grow px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm" disabled={isKeyLoading} />
                        <button onClick={handleSaveApiKey} disabled={isLoading || isKeySaved} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-green-400 dark:disabled:bg-green-800 disabled:cursor-not-allowed flex items-center"><Save className="h-5 w-5 mr-2"/>{isKeySaved ? 'Saved' : 'Save'}</button>
                    </div>
                </div>

                <div className="mb-4 relative">
                    <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Enter brand name here." className="w-full pl-10 pr-36 py-3 text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:ring-2 focus:ring-blue-500" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <button onClick={() => handleAnalyze(brandName, '')} disabled={isLoading || !isKeySaved} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
                        {isLoading ? 'Analyzing...' : 'Analyze Brand'}
                    </button>
                </div>
                
                {analysis && !isLoading && (
                    <div className="mb-8 relative animate-fade-in">
                        <input type="text" value={refinementQuery} onChange={(e) => setRefinementQuery(e.target.value)} placeholder={`Refine report for "${currentBrandAnalyzed}" (e.g., SmartThings updates)`} className="w-full pl-10 pr-36 py-3 text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:ring-2 focus:ring-indigo-500" />
                        <Telescope className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <button onClick={() => handleAnalyze(currentBrandAnalyzed, refinementQuery)} disabled={isLoading || !refinementQuery} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed">
                            Refine
                        </button>
                    </div>
                )}

                {error && <p className="text-red-500 text-sm mt-2 text-center mb-4">{error}</p>}

                {analysis ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                            <h2 className="text-2xl font-bold flex items-center mb-4 text-gray-900 dark:text-white"><BrainCircuit className="h-8 w-8 mr-3 text-blue-500" />AI Summary for {currentBrandAnalyzed}</h2>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
                        </div>
                        
                        <div className="bg-indigo-50 dark:bg-gray-800/50 p-6 rounded-xl shadow-md">
                             <h2 className="text-2xl font-bold flex items-center mb-4 text-indigo-800 dark:text-indigo-300">Strategic PR Insights</h2>
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <SWOTCard swot={analysis.pr_insights.swot_analysis} />
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                        <h2 className="text-xl font-semibold flex items-center mb-4"><AtSign className="h-6 w-6 mr-3 text-indigo-500" />Corporate Communications</h2>
                                        <ul className="space-y-3">{analysis.pr_insights.key_media_contacts.internal.map((c, i) => <li key={i}><a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{c.name} <span className="font-normal text-gray-500 dark:text-gray-400">- {c.outlet}</span></a><p className="text-xs text-gray-500 dark:text-gray-400">{c.beat}</p></li>)}</ul>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                        <h2 className="text-xl font-semibold flex items-center mb-4"><PenTool className="h-6 w-6 mr-3 text-indigo-500" />External Media & Influencers</h2>
                                        <ul className="space-y-3">{analysis.pr_insights.key_media_contacts.external.map((c, i) => <li key={i}><a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{c.name} <span className="font-normal text-gray-500 dark:text-gray-400">- {c.outlet}</span></a><p className="text-xs text-gray-500 dark:text-gray-400">Beat: {c.beat}</p></li>)}</ul>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                        <h2 className="text-xl font-semibold flex items-center mb-4"><Lightbulb className="h-6 w-6 mr-3 text-indigo-500" />Suggested Story Angles</h2>
                                        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">{analysis.pr_insights.suggested_story_angles.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                    </div>
                                </div>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <h2 className="text-xl font-semibold flex items-center mb-4"><BarChart className="h-6 w-6 mr-3 text-blue-500" />Sentiment Analysis</h2>
                                <SentimentBar positive={analysis.sentiment.positive.value} negative={analysis.sentiment.negative.value} neutral={analysis.sentiment.neutral.value} />
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start"><ThumbsUp className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"/><div><strong className="text-green-500">Positive ({analysis.sentiment.positive.value}%)</strong><p className="text-xs text-gray-500 dark:text-gray-400">{analysis.sentiment.positive.summary}</p></div></div>
                                    <div className="flex items-start"><ThumbsDown className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5"/><div><strong className="text-red-500">Negative ({analysis.sentiment.negative.value}%)</strong><p className="text-xs text-gray-500 dark:text-gray-400">{analysis.sentiment.negative.summary}</p></div></div>
                                    <div className="flex items-start"><Meh className="h-5 w-5 text-gray-500 mr-3 flex-shrink-0 mt-0.5"/><div><strong className="text-gray-500">Neutral ({analysis.sentiment.neutral.value}%)</strong><p className="text-xs text-gray-500 dark:text-gray-400">{analysis.sentiment.neutral.summary}</p></div></div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><h2 className="text-xl font-semibold flex items-center mb-4"><BrainCircuit className="h-6 w-6 mr-3 text-blue-500" />Key Themes</h2><ul className="space-y-2">{analysis.themes.map((t, i) => <li key={i} className="flex items-center"><span className="text-blue-500 font-bold mr-2">#</span>{t}</li>)}</ul></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col"><h2 className="text-xl font-semibold flex items-center mb-4"><Newspaper className="h-6 w-6 mr-3 text-blue-500" />Recent Headlines</h2><ul className="space-y-4 flex-grow">{analysis.articles.slice(0, visibleArticles).map((a, i) => <li key={i}><a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{a.title}</a><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{a.summary}</p></li>)}</ul>{analysis.articles.length > visibleArticles && (<button onClick={() => setVisibleArticles(visibleArticles + 7)} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 self-start">Load More</button>)}</div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col"><h2 className="text-xl font-semibold flex items-center mb-4"><MessageSquareQuote className="h-6 w-6 mr-3 text-blue-500" />Social Buzz</h2><ul className="space-y-4 flex-grow">{analysis.social_discussions.slice(0, visibleSocial).map((s, i) => <li key={i} className="flex items-start"><div className="flex-shrink-0"><SocialIcon platform={s.platform} /></div><div><a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{s.title}</a><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.summary}</p></div></li>)}</ul>{analysis.social_discussions.length > visibleSocial && (<button onClick={() => setVisibleSocial(visibleSocial + 7)} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 self-start">Load More</button>)}</div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><h2 className="text-xl font-semibold flex items-center mb-4"><ShieldCheck className="h-6 w-6 mr-3 text-indigo-500" />Competitor Landscape</h2><ul className="space-y-4">{analysis.competitors.map((c, i) => <li key={i}><button onClick={() => handleCompetitorClick(c.name)} className="font-semibold text-blue-600 hover:underline flex items-center"><RefreshCw className="h-4 w-4 mr-2 opacity-70"/>Analyze {c.name}</button><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{c.summary}</p></li>)}</ul></div>
                            { analysis.linkedin_snapshot && <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md"><h2 className="text-xl font-semibold flex items-center mb-4"><Linkedin className="h-6 w-6 mr-3 text-sky-600" />Corporate Snapshot</h2><ul className="space-y-3">
                                <li className="flex items-center"><Building className="h-5 w-5 mr-3 text-gray-400"/>Employee Count: <span className="font-semibold ml-2">{analysis.linkedin_snapshot.employee_count}</span></li>
                                <li className="flex items-center"><HiringTrendIcon trend={analysis.linkedin_snapshot.hiring_trend}/><span className="ml-3">Hiring Trend:</span> <span className="font-semibold ml-2 capitalize">{analysis.linkedin_snapshot.hiring_trend}</span></li>
                                {analysis.linkedin_snapshot.key_executives.map((e,i) => <li key={i} className="flex"><Briefcase className="h-5 w-5 mr-3 text-gray-400 flex-shrink-0 mt-1"/><div className="flex flex-col"><span>{e.title}</span><span className="font-semibold">{e.name}</span></div></li>)}
                            </ul></div>}
                        </div>

                        { analysis.stock_info &&
                        <div className="grid grid-cols-1">
                             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                                <h2 className="text-xl font-semibold flex items-center mb-4"><TrendingUp className="h-6 w-6 mr-3 text-green-500" />Market Snapshot</h2>
                                <div className="flex justify-between items-baseline mb-2">
                                    <div>
                                        <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">{analysis.stock_info.name} ({analysis.stock_info.ticker})</p>
                                        <span className="text-3xl font-bold">{analysis.stock_info.price}</span>
                                    </div>
                                    <div className={`flex items-center font-semibold text-lg ${analysis.stock_info.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        <StockTrendIcon trend={analysis.stock_info.change_percent}/> <span className="ml-2">{analysis.stock_info.change_percent}% Today</span>
                                    </div>
                                </div>
                                <StockChart stockInfo={analysis.stock_info} />
                                <p className="text-sm text-gray-500 mt-3">{analysis.stock_info.summary}</p>
                             </div>
                        </div>}
                         { !analysis.stock_info &&
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center justify-center"><p className="text-gray-500">Market data not available. This may be a private company.</p></div>
                         }
                    </div>
                ) : (
                    !isLoading && <div className="text-center py-20"><BrainCircuit className="mx-auto h-12 w-12 text-gray-400" /><h3 className="mt-2 text-lg font-medium">Analysis will appear here</h3><p className="mt-1 text-sm text-gray-500">{isKeySaved ? "Enter a brand name to start." : "Please save your API key to enable analysis."}</p></div>
                )}
            </div>
            <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};

export default App;
