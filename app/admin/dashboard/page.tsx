"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { ref, get } from "firebase/database"
import { db } from "@/app/firebase"
import { FiUsers, FiEye, FiHeart, FiShare2, FiFile, FiCalendar, FiMail } from "react-icons/fi"
import { Line, Pie } from "react-chartjs-2"
import { useRouter } from "next/navigation"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/app/firebase"

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// User and article interfaces
interface User {
  id: string
  displayName?: string
  email?: string
  createdAt: string | number
  role?: string
  provider?: string
}

// Chart data interfaces
interface ChartDataset {
  label: string
  data: number[]
  borderColor: string | string[]
  backgroundColor: string | string[]
  tension?: number
  fill?: boolean
  borderWidth?: number
  pointRadius?: number
  pointHoverRadius?: number
  pointBackgroundColor?: string
  pointBorderColor?: string
  pointBorderWidth?: number
}

interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

// Format numbers with commas
const formatNumber = (num: number) => {
  return new Intl.NumberFormat("it-IT").format(num);
};

// StatCard component
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{title}</span>
        <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mt-1">
          {formatNumber(value)}
        </span>
      </div>
      <div className={`h-12 w-12 rounded-full ${colorClass} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  </motion.div>
);

export default function AdminDashboard() {
  const router = useRouter()
  // Stats state
  const [displayedUsers, setDisplayedUsers] = useState(0)
  const [displayedArticles, setDisplayedArticles] = useState(0)
  const [displayedViews, setDisplayedViews] = useState(0)
  const [displayedLikes, setDisplayedLikes] = useState(0)
  const [displayedShares, setDisplayedShares] = useState(0)
  
  // User auth state
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  
  // Paginazione utenti
  const [currentPage, setCurrentPage] = useState(0)
  const usersPerPage = 5
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  
  // User registration data for graph
  const [userRegData, setUserRegData] = useState<ChartData>({
    labels: [],
    datasets: []
  })
  
  // Article stats data for graph
  const [articleData, setArticleData] = useState<ChartData>({
    labels: [],
    datasets: []
  })
  
  // Recent users
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  
  // Animation refs
  const countersAnimated = useRef(false)
  
  // CountUp animation
  const animateCounter = (start: number, end: number, setter: React.Dispatch<React.SetStateAction<number>>, duration = 2000) => {
    const startTime = performance.now()
    
    const updateCounter = (time: number) => {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = Math.floor(start + (end - start) * easeOutQuart)
      
      setter(current)
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter)
      }
    }
    
    requestAnimationFrame(updateCounter)
  }
  
  // Verifica se l'utente è autorizzato
  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        // Setup proper Firebase auth listener
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          // Get the list of superior emails from environment variables
          const superiorEmails = process.env.NEXT_PUBLIC_SUPERIOR_EMAILS 
            ? JSON.parse(process.env.NEXT_PUBLIC_SUPERIOR_EMAILS) 
            : []
          
          if (user) {
            // Verifica se l'email è verificata per gli accessi con email/password
            if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
              // Se l'email non è verificata, reindirizza alla pagina di verifica
              router.push('/verify-email')
              return
            }
            
            // Check if user's email is in the SUPERIOR_EMAILS list
            if (superiorEmails.includes(user.email || '')) {
              setIsAuthorized(true)
              
              // Fetch additional user data from database if needed
              const userRef = ref(db, `utenti/${user.uid}`)
              const userSnapshot = await get(userRef)
              
              if (userSnapshot.exists()) {
                const userData = userSnapshot.val()
                setCurrentUser({
                  id: user.uid,
                  ...userData
                })
              }

              // Call fetchData to load dashboard data once the user is authenticated
              fetchData()
            } else {
              // Reindirizza alla home page se non è un utente SUPERIOR
              router.push('/')
            }
          } else {
            // Reindirizza alla home page se non è loggato
            router.push('/')
          }
          
          setAuthChecked(true)
        })
        
        // Clean up the listener when component unmounts
        return () => unsubscribe()
      } catch (error) {
        console.error("Error checking user auth:", error)
        setAuthChecked(true)
        setLoading(false)
        router.push('/') // Reindirizza in caso di errore
      }
    }
    
    checkUserAuth()
  }, [router])
  
  // Fetch dashboard data
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      
      console.log('Dashboard data received:', data);
      
      if (data.error) {
        console.error('Error from API:', data.error);
        return;
      }
      
      // Extract stats values with fallbacks
      const totalUsersVal = data.stats?.totalUsers || 0;
      const totalArticlesVal = data.stats?.totalArticles || 0;
      const totalViewsVal = data.stats?.totalViews || 0;
      const totalLikesVal = data.stats?.totalLikes || 0;
      const totalSharesVal = data.stats?.totalShares || 0;
      
      // Set all users, not just recent ones
      if (data.users && data.users.length > 0) {
        // Use ALL users from the API
        setRecentUsers(data.users.map((user: {
          id: string;
          displayName?: string;
          email?: string;
          createdAt?: string | number;
          role?: string;
          provider?: string;
        }) => ({
          ...user,
          displayName: user.displayName || 'Utente senza nome',
          email: user.email || 'Email non disponibile',
          createdAt: user.createdAt || new Date().toISOString(),
          provider: user.provider || 'Email'
        })));
      } else if (data.recentUsers && data.recentUsers.length > 0) {
        // Fallback to recentUsers if users array is not available
        setRecentUsers(data.recentUsers.map((user: {
          id: string;
          displayName?: string;
          email?: string;
          createdAt?: string | number;
          role?: string;
          provider?: string;
        }) => ({
          ...user,
          displayName: user.displayName || 'Utente senza nome',
          email: user.email || 'Email non disponibile',
          createdAt: user.createdAt || new Date().toISOString(),
          provider: user.provider || 'Email'
        })));
      } else {
        console.warn("No users data received from API");
        setRecentUsers([]);
      }
      
      // Process registration data for the line chart
      if (data.registrationChartData && data.registrationChartData.length > 0) {
        // Formatta i dati per Chart.js
        const months = data.registrationChartData.map((item: {
          month: string;
          year: number;
          key: string;
          count: number;
        }) => `${item.month} ${item.year.toString().slice(2)}`);
        
        const counts = data.registrationChartData.map((item: {
          month: string;
          year: number;
          key: string;
          count: number;
        }) => item.count);
        
        console.log('Registration chart data:', months, counts);
        
        setUserRegData({
          labels: months,
          datasets: [
            {
              label: 'Nuovi Utenti',
              data: counts,
              fill: true,
              backgroundColor: 'rgba(147, 51, 234, 0.2)',
              borderColor: 'rgba(147, 51, 234, 1)',
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: 'white',
              pointBorderColor: 'rgba(147, 51, 234, 1)',
              pointBorderWidth: 2,
            },
          ],
        });
      } else {
        console.warn("No registration data received from API, using fallback");
        // Fallback empty chart data
        setUserRegData({
          labels: [],
          datasets: []
        });
      }
      
      // Process article categories data for pie chart
      if (data.categoryCounts && Object.keys(data.categoryCounts).length > 0) {
        try {
          const chartLabels = Object.keys(data.categoryCounts);
          
          // Generate colors for the pie chart
          const backgroundColors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(199, 199, 199, 0.7)',
            'rgba(83, 102, 255, 0.7)',
            'rgba(40, 159, 192, 0.7)',
            'rgba(210, 199, 199, 0.7)',
            'rgba(78, 52, 199, 0.7)',
          ];
          
          const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));
          
          // Calculate the total count for percentage calculation
          const totalCount = chartLabels.reduce((sum, cat) => sum + data.categoryCounts[cat], 0);
          
          // Create labels with percentages
          const labelsWithPercentages = chartLabels.map(cat => {
            const count = data.categoryCounts[cat];
            const percentage = ((count / totalCount) * 100).toFixed(1);
            return `${cat} (${percentage}%)`;
          });
          
          const chartData: ChartData = {
            labels: labelsWithPercentages,
            datasets: [
              {
                label: 'Articoli per categoria',
                data: chartLabels.map(cat => data.categoryCounts[cat]),
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
              }
            ]
          };
          
          setArticleData(chartData);
        } catch (error) {
          console.error("Error processing category data:", error);
        }
      } else if (data.tagCounts && Object.keys(data.tagCounts).length > 0) {
        // Fallback to tagCounts if categoryCounts is empty
        try {
          console.log("Using tagCounts for pie chart");
          const chartLabels = Object.keys(data.tagCounts);
          
          // Generate colors for the pie chart
          const backgroundColors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(199, 199, 199, 0.7)',
            'rgba(83, 102, 255, 0.7)',
            'rgba(40, 159, 192, 0.7)',
            'rgba(210, 199, 199, 0.7)',
            'rgba(78, 52, 199, 0.7)',
          ];
          
          const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));
          
          // Calculate the total count for percentage calculation
          const totalCount = chartLabels.reduce((sum, tag) => sum + data.tagCounts[tag], 0);
          
          // Create labels with percentages
          const labelsWithPercentages = chartLabels.map(tag => {
            const count = data.tagCounts[tag];
            const percentage = ((count / totalCount) * 100).toFixed(1);
            return `${tag} (${percentage}%)`;
          });
          
          const chartData: ChartData = {
            labels: labelsWithPercentages,
            datasets: [
              {
                label: 'Articoli per tag',
                data: chartLabels.map(tag => data.tagCounts[tag]),
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
              }
            ]
          };
          
          setArticleData(chartData);
        } catch (error) {
          console.error("Error processing tag data:", error);
        }
      } else {
        console.warn("No category or tag data received from API");
      }
      
      // Animate counters
      if (!countersAnimated.current) {
        animateCounter(0, totalUsersVal, setDisplayedUsers);
        animateCounter(0, totalArticlesVal, setDisplayedArticles);
        animateCounter(0, totalViewsVal, setDisplayedViews);
        animateCounter(0, totalLikesVal, setDisplayedLikes);
        animateCounter(0, totalSharesVal, setDisplayedShares);
        countersAnimated.current = true;
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format date
  const formatFullDate = (dateString: string | number | undefined): string => {
    if (!dateString) return 'Data non disponibile'
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // Filter and sort users
  const filteredUsers = recentUsers
    .filter(user => {
      // Filter by search term (name or email)
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const nameMatch = user.displayName?.toLowerCase().includes(searchTermLower);
        const emailMatch = user.email?.toLowerCase().includes(searchTermLower);
        if (!nameMatch && !emailMatch) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  
  // Don't render until auth is checked
  if (!authChecked || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full"></div>
      </div>
    )
  }
  
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 pb-16">
      {/* Modern sticky header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-700 mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Add back button */}
            <button 
              onClick={() => router.push('/')}
              className="cursor-pointer flex items-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Torna alla home</span>
            </button>
            
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Dashboard Admin</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Panoramica e statistiche</p>
            </div>
          </div>
          
          {currentUser && (
            <div className="flex items-center">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium mr-3">
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{currentUser.displayName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentUser.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats overview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
          {/* Users card */}
          <StatCard title="Utenti" value={displayedUsers} icon={<FiUsers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />} colorClass="bg-indigo-50 dark:bg-indigo-900/30" />
          
          {/* Articles card */}
          <StatCard title="Articoli" value={displayedArticles} icon={<FiFile className="h-6 w-6 text-blue-600 dark:text-blue-400" />} colorClass="bg-blue-50 dark:bg-blue-900/30" />
          
          {/* Views card */}
          <StatCard title="Visualizzazioni" value={displayedViews} icon={<FiEye className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />} colorClass="bg-emerald-50 dark:bg-emerald-900/30" />
          
          {/* Likes card */}
          <StatCard title="Mi Piace" value={displayedLikes} icon={<FiHeart className="h-6 w-6 text-rose-600 dark:text-rose-400" />} colorClass="bg-rose-50 dark:bg-rose-900/30" />
          
          {/* Shares card */}
          <StatCard title="Condivisioni" value={displayedShares} icon={<FiShare2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />} colorClass="bg-amber-50 dark:bg-amber-900/30" />
        </div>
      
        {/* Charts and data section - using CSS grid for a more modern layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* User registrations chart - wider */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 lg:col-span-8"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Storico Iscrizioni</h2>
            
            {loading ? (
              <div className="animate-pulse h-64 bg-zinc-100 dark:bg-zinc-700 rounded-lg"></div>
            ) : (
              <div className="h-64">
                <Line
                  data={userRegData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          boxWidth: 15,
                          usePointStyle: true,
                          color: 'rgb(156, 163, 175)'
                        }
                      },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          color: 'rgb(156, 163, 175)'
                        },
                        grid: {
                          color: 'rgba(156, 163, 175, 0.1)'
                        }
                      },
                      x: {
                        ticks: {
                          color: 'rgb(156, 163, 175)'
                        },
                        grid: {
                          display: false
                        }
                      }
                    },
                    interaction: {
                      mode: 'nearest',
                      axis: 'x',
                      intersect: false
                    }
                  }}
                />
              </div>
            )}
          </motion.div>
          
          {/* Article categories chart - narrower */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 lg:col-span-4"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Categorie Articoli</h2>
            
            {loading ? (
              <div className="animate-pulse h-64 bg-zinc-100 dark:bg-zinc-700 rounded-lg"></div>
            ) : (
              <div className="h-64">
                <Pie
                  data={articleData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: {
                          boxWidth: 12,
                          padding: 15,
                          usePointStyle: true,
                          color: 'rgb(156, 163, 175)',
                          font: {
                            size: 10 // Smaller font size for legend to fit percentages
                          }
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                          size: 14
                        },
                        bodyFont: {
                          size: 13
                        },
                        callbacks: {
                          label: function(context) {
                            const label = context.label || '';
                            const value = context.raw as number;
                            const total = context.dataset.data.reduce((a, b) => (a as number) + (b as number), 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label.split(' (')[0]}: ${value} articoli (${percentage}%)`;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            )}
          </motion.div>
        </div>
        
        {/* Recent users section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Utenti</h2>
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full">
              {`Pagina ${currentPage + 1}/${Math.max(1, Math.ceil(filteredUsers.length / usersPerPage))}`}
            </span>
          </div>
          
          {/* Search and Filters */}
          <div className="mb-6 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Search box */}
              <div className="relative flex-grow max-w-md">
                <input
                  type="text"
                  placeholder="Cerca per nome o email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(0); // Reset to first page when searching
                  }}
                  className="w-full px-4 py-2 pl-10 text-sm bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                />
                <svg 
                  className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Sort Order */}
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600 cursor-pointer"
              >
                <span>Data</span>
                {sortOrder === "asc" ? (
                  <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                ) : (
                  <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Filter statistics */}
            {searchTerm && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Risultati: {filteredUsers.length} utenti cercando &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-700"></div>
                  <div className="flex-1">
                    <div className="h-4 w-1/3 bg-zinc-100 dark:bg-zinc-700 rounded mb-2"></div>
                    <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-700 rounded"></div>
                  </div>
                  <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                  <thead>
                    <tr>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">Utente</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">Email</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">Data Registrazione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          Nessun utente trovato con i filtri selezionati.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers
                        .slice(currentPage * usersPerPage, (currentPage + 1) * usersPerPage)
                        .map((user, index) => (
                          <motion.tr 
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
                          >
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-lg">
                                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{user.displayName || 'Utente'}</div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {user.role || 'utente'} 
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                              <div className="flex items-center">
                                <FiMail className="mr-2 h-4 w-4 text-zinc-400" />
                                {user.email || 'Email non disponibile'}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                              <div className="flex items-center">
                                <FiCalendar className="mr-2 h-4 w-4 text-zinc-400" />
                                {formatFullDate(user.createdAt)}
                              </div>
                            </td>
                          </motion.tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination controls */}
              {filteredUsers.length > usersPerPage && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${
                      currentPage === 0 
                        ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed' 
                        : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                    }`}
                  >
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Precedente
                  </button>
                  
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Pagina {currentPage + 1} di {Math.ceil(filteredUsers.length / usersPerPage)}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / usersPerPage) - 1, prev + 1))}
                    disabled={currentPage === Math.ceil(filteredUsers.length / usersPerPage) - 1}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${
                      currentPage === Math.ceil(filteredUsers.length / usersPerPage) - 1 
                        ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed' 
                        : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                    }`}
                  >
                    Successiva
                    <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </main>
  )
} 