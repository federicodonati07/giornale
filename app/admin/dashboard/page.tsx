"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { ref, get, onValue } from "firebase/database"
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

// Interfaccia per gli articoli del formato API
interface ApiArticle {
  id?: string
  uuid?: string
  title?: string
  titolo?: string
  status?: string
  createdAt?: string | number
  creazione?: string | number
  publishedAt?: string | number
}

interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
  _detailedLabels?: string[] // Detailed labels for tooltips
}

// Period options for time filtering
type TimePeriod = 'month' | 'year' | 'all';

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

// Article interface
interface Article {
  id: string
  title?: string
  titolo?: string
  status?: 'published' | 'review' | 'scheduled' | 'accepted' | string
  createdAt: string | number
  creazione?: string | number
  publishedAt?: string | number
  uuid?: string
}

// Firebase data interfaces
interface FirebaseUser {
  displayName?: string
  email?: string
  createdAt?: number | string
  role?: string
  provider?: string
}

interface FirebaseArticle {
  creazione?: number | string
  titolo?: string
  status?: string
  contenuto?: string
  categoria?: string
  tags?: string[]
  autore?: string
  pubblicazione?: number | string
}

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
  
  // Selected time period filter
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('year')
  
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
  
  // Articles data for graph
  const [articlesData, setArticlesData] = useState<Article[]>([])
  
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
  
  // Generate user registration chart data directly from user objects with article data
  const generateUserRegistrationData = (users: User[], articles: Article[], period: TimePeriod) => {
    if (!users || users.length === 0) {
      setUserRegData({
        labels: [],
        datasets: []
      });
      return;
    }
    
    // Current date for filtering
    const now = new Date();
    
    // Create independent timelines for both users and articles
    const userTimeline: {date: Date, count: number}[] = [];
    const articleTimeline: {date: Date, count: number}[] = [];
    
    // Use all articles, not just accepted ones
    const allArticles = articles;
    
    console.log("Total articles:", allArticles.length);
    
    // Filter based on selected period
    let periodStartDate: Date | null = null;
    
    if (period === 'month') {
      // Last 30 days
      periodStartDate = new Date();
      periodStartDate.setDate(now.getDate() - 30);
    } else if (period === 'year') {
      // Current year (Jan 1st to now)
      periodStartDate = new Date(now.getFullYear(), 0, 1);
    } else {
      // All time - no filter
      periodStartDate = null;
    }
    
    // Process users
    users.forEach(user => {
      const userDate = new Date(user.createdAt || 0);
      
      // Apply period filter if needed
      if (periodStartDate && userDate < periodStartDate) {
        return;
      }
      
      // Find or create entry
      let entry = userTimeline.find(item => {
        const itemDate = item.date;
        return period === 'month' 
          ? (itemDate.getFullYear() === userDate.getFullYear() && 
             itemDate.getMonth() === userDate.getMonth() && 
             itemDate.getDate() === userDate.getDate())
          : (itemDate.getFullYear() === userDate.getFullYear() && 
             itemDate.getMonth() === userDate.getMonth());
      });
      
      if (!entry) {
        // Create new entry with the appropriate date
        entry = {
          date: period === 'month' 
            ? new Date(userDate.getFullYear(), userDate.getMonth(), userDate.getDate())
            : new Date(userDate.getFullYear(), userDate.getMonth(), 15),
          count: 0
        };
        userTimeline.push(entry);
      }
      
      // Increment count
      entry.count++;
    });
    
    // Process articles - completely independent from users
    allArticles.forEach(article => {
      const articleDate = new Date(article.createdAt || 0);
      
      // Apply period filter if needed
      if (periodStartDate && articleDate < periodStartDate) {
        return;
      }
      
      // Find or create entry
      let entry = articleTimeline.find(item => {
        const itemDate = item.date;
        return period === 'month' 
          ? (itemDate.getFullYear() === articleDate.getFullYear() && 
             itemDate.getMonth() === articleDate.getMonth() && 
             itemDate.getDate() === articleDate.getDate())
          : (itemDate.getFullYear() === articleDate.getFullYear() && 
             itemDate.getMonth() === articleDate.getMonth());
      });
      
      if (!entry) {
        // Create new entry with the appropriate date
        entry = {
          date: period === 'month' 
            ? new Date(articleDate.getFullYear(), articleDate.getMonth(), articleDate.getDate())
            : new Date(articleDate.getFullYear(), articleDate.getMonth(), 15),
          count: 0
        };
        articleTimeline.push(entry);
      }
      
      // Increment count
      entry.count++;
    });
    
    // Sort both timelines
    userTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    articleTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // For year view, ensure all months are represented
    if (period === 'year') {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // Create all 12 months if not already in the timelines
      for (let month = 0; month <= currentMonth; month++) {
        // For user timeline
        const userMonthEntry = userTimeline.find(entry => 
          entry.date.getFullYear() === currentYear && entry.date.getMonth() === month
        );
        
        if (!userMonthEntry) {
          userTimeline.push({
            date: new Date(currentYear, month, 15),
            count: 0
          });
        }
        
        // For article timeline
        const articleMonthEntry = articleTimeline.find(entry => 
          entry.date.getFullYear() === currentYear && entry.date.getMonth() === month
        );
        
        if (!articleMonthEntry) {
          articleTimeline.push({
            date: new Date(currentYear, month, 15),
            count: 0
          });
        }
      }
      
      // Re-sort both timelines
      userTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());
      articleTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    
    // Calculate cumulative counts
    let cumulativeUserCount = 0;
    const cumulativeUserCounts = userTimeline.map(point => {
      cumulativeUserCount += point.count;
      return cumulativeUserCount;
    });
    
    let cumulativeArticleCount = 0;
    const cumulativeArticleCounts = articleTimeline.map(point => {
      cumulativeArticleCount += point.count;
      return cumulativeArticleCount;
    });
    
    // Generate labels based on the user timeline (we'll map article data to match these points)
    const labels = userTimeline.map(point => {
      if (period === 'month') {
        // Show day and abbreviated month for monthly view (e.g. "15 Gen")
        return point.date.toLocaleDateString('it-IT', { 
          day: 'numeric',
          month: 'short'
        });
      } else if (period === 'year') {
        // For yearly view, group by month
        return point.date.toLocaleDateString('it-IT', { month: 'long' });
      } else {
        // For all time, show month and year
        return point.date.toLocaleDateString('it-IT', { 
          month: 'short',
          year: 'numeric'
        });
      }
    });
    
    // Generate detailed tooltip labels
    const detailedLabels = userTimeline.map((point, index) => {
      // Find matching article data point
      const articleMatch = articleTimeline.find(a => 
        period === 'month'
          ? (a.date.getFullYear() === point.date.getFullYear() && 
             a.date.getMonth() === point.date.getMonth() && 
             a.date.getDate() === point.date.getDate())
          : (a.date.getFullYear() === point.date.getFullYear() && 
             a.date.getMonth() === point.date.getMonth())
      );
      
      const articleCount = articleMatch ? cumulativeArticleCounts[articleTimeline.indexOf(articleMatch)] : 0;
      
      // Format date and show cumulative counts
      return `${point.date.toLocaleDateString('it-IT', { 
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })}:\nUtenti: ${cumulativeUserCounts[index]}\nArticoli: ${articleCount}`;
    });
    
    // Map article data to match user timeline points
    const articleDataPoints = userTimeline.map(userPoint => {
      // Find matching article data point
      const articleMatch = articleTimeline.find(a => 
        period === 'month'
          ? (a.date.getFullYear() === userPoint.date.getFullYear() && 
             a.date.getMonth() === userPoint.date.getMonth() && 
             a.date.getDate() === userPoint.date.getDate())
          : (a.date.getFullYear() === userPoint.date.getFullYear() && 
             a.date.getMonth() === userPoint.date.getMonth())
      );
      
      return articleMatch ? cumulativeArticleCounts[articleTimeline.indexOf(articleMatch)] : 0;
    });
    
    // Create the final chart data
    setUserRegData({
      labels,
      datasets: [
        {
          label: 'Utenti Totali',
          data: cumulativeUserCounts,
          fill: true,
          backgroundColor: 'rgba(147, 51, 234, 0.2)',
          borderColor: 'rgba(147, 51, 234, 1)',
          tension: 0.4,
          borderWidth: 2,
          pointRadius: period === 'month' && userTimeline.length > 10 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: 'white',
          pointBorderColor: 'rgba(147, 51, 234, 1)',
          pointBorderWidth: 2,
        },
        {
          label: 'Articoli Pubblicati',
          data: articleDataPoints,
          fill: true,
          backgroundColor: 'rgba(20, 184, 166, 0.2)',
          borderColor: 'rgba(20, 184, 166, 1)',
          tension: 0.4,
          borderWidth: 2,
          pointRadius: period === 'month' && articleTimeline.length > 10 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: 'white',
          pointBorderColor: 'rgba(20, 184, 166, 1)',
          pointBorderWidth: 2,
        }
      ],
      _detailedLabels: detailedLabels
    });
  };
  
  // Fetch dashboard data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Get articles directly from Firebase
      const articlesRef = ref(db, 'articoli');
      const articlesSnapshot = await get(articlesRef);
      
      let articles: Article[] = [];
      let totalArticles = 0;
      
      if (articlesSnapshot.exists()) {
        const articlesData = articlesSnapshot.val() as Record<string, FirebaseArticle>;
        articles = Object.entries(articlesData).map(([uuid, data]) => ({
          id: uuid,
          uuid: uuid,
          ...data,
          createdAt: data.creazione || new Date().getTime(),
          creazione: data.creazione || new Date().getTime()
        }));
        totalArticles = articles.length;
        console.log("Articles from Firebase:", articles);
      }

      const response = await fetch('/api/dashboard');
      const data = await response.json();
      
      console.log('Dashboard data received:', data);
      
      if (data.error) {
        console.error('Error from API:', data.error);
        return;
      }
      
      // Extract stats values with fallbacks
      const totalUsersVal = data.stats?.totalUsers || 0;
      const totalArticlesVal = totalArticles; // Use the count from Firebase
      const totalViewsVal = data.stats?.totalViews || 0;
      const totalLikesVal = data.stats?.totalLikes || 0;
      const totalSharesVal = data.stats?.totalShares || 0;
      
      // Set all users, not just recent ones
      if (data.users && data.users.length > 0) {
        const usersWithDateObj = data.users.map((user: {
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
        }));
        
        setRecentUsers(usersWithDateObj);
        
        // Use articles from Firebase
        if (articles.length > 0) {
          console.log("Total articles from Firebase:", articles.length);
          setArticlesData(articles);
          generateUserRegistrationData(usersWithDateObj, articles, selectedPeriod);
        } else {
          generateUserRegistrationData(usersWithDateObj, [], selectedPeriod);
        }
      } else if (data.recentUsers && data.recentUsers.length > 0) {
        // Fallback to recentUsers if users array is not available
        const usersWithDateObj = data.recentUsers.map((user: {
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
        }));
        
        setRecentUsers(usersWithDateObj);
        
        // Store articles data
        if (data.articles && data.articles.length > 0) {
          // Log the articles data to debug
          console.log("All articles data:", data.articles);
          
          // Map all articles without filtering by status
          const allArticles = data.articles
            .map((article: ApiArticle) => ({
              id: article.id || article.uuid || '',
              title: article.title || article.titolo || 'Articolo senza titolo',
              status: article.status || 'review',
              createdAt: article.createdAt || article.creazione || new Date().toISOString(),
              publishedAt: article.publishedAt || article.createdAt || article.creazione || new Date().toISOString()
            }));
          
          setArticlesData(allArticles);
          
          // Generate registration chart data with articles
          generateUserRegistrationData(usersWithDateObj, allArticles, selectedPeriod);
        } else {
          // Generate registration chart data without articles
          generateUserRegistrationData(usersWithDateObj, [], selectedPeriod);
        }
      } else {
        console.warn("No users data received from API");
        setRecentUsers([]);
        
        // Empty chart data
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
  
  // Update chart when time period changes
  useEffect(() => {
    if (recentUsers.length > 0) {
      generateUserRegistrationData(recentUsers, articlesData, selectedPeriod);
    }
  }, [selectedPeriod, recentUsers, articlesData]);
  
  // Real-time listener for articles
  useEffect(() => {
    const articlesRef = ref(db, 'articoli');
    const unsubscribe = onValue(articlesRef, (snapshot) => {
      if (snapshot.exists()) {
        const articlesData = snapshot.val() as Record<string, FirebaseArticle>;
        
        // Debug articles data
        console.log("Raw articles data from Firebase:", articlesData);
        
        const articles = Object.entries(articlesData).map(([uuid, data]) => {
          // Ensure we're properly handling creazione timestamp
          const creationTimestamp = data.creazione || 0;
          let creationDate: number;
          
          // Handle different timestamp formats
          if (typeof creationTimestamp === 'number') {
            // Already a number (milliseconds)
            creationDate = creationTimestamp;
          } else if (typeof creationTimestamp === 'string') {
            // Try to parse string timestamp
            const parsedTime = Date.parse(creationTimestamp);
            creationDate = isNaN(parsedTime) ? Date.now() : parsedTime;
          } else {
            // Fallback to current time
            creationDate = Date.now();
          }
          
          return {
            id: uuid,
            uuid: uuid,
            title: data.titolo,
            status: data.status,
            createdAt: creationDate,
            creazione: creationDate,
            publishedAt: typeof data.pubblicazione === 'number' ? data.pubblicazione : creationDate
          };
        });
        
        // Sort articles by creation date
        articles.sort((a, b) => a.createdAt - b.createdAt);
        
        // Debug processed articles
        console.log("Processed articles with creation dates:", articles.map(a => ({
          id: a.id,
          title: a.title,
          createdAt: new Date(a.createdAt).toISOString()
        })));
        
        setArticlesData(articles);
        setDisplayedArticles(articles.length);

        if (recentUsers.length > 0) {
          // Create simple chart data without complex processing functions
          const now = new Date();
          let startDate: Date;
          const datePoints: Date[] = [];
          
          // Prepare time range based on period
          if (selectedPeriod === 'month') {
            // Last 30 days
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            
            // One point per day
            for (let i = 0; i <= 30; i++) {
              const date = new Date(startDate);
              date.setDate(date.getDate() + i);
              date.setHours(0, 0, 0, 0); // Ensure time is set to midnight
              datePoints.push(date);
            }
          } else if (selectedPeriod === 'year') {
            // Current year
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            
            // One point per month
            for (let i = 0; i <= now.getMonth(); i++) {
              const date = new Date(now.getFullYear(), i, 1);
              date.setHours(0, 0, 0, 0);
              datePoints.push(date);
            }
          } else {
            // All time - find earliest date between users and articles
            const sortedArticles = [...articles];
            const sortedUsers = [...recentUsers];
            
            if (sortedArticles.length > 0 && sortedUsers.length > 0) {
              const earliestArticleDate = new Date(sortedArticles[0].createdAt);
              const earliestUserDate = new Date(sortedUsers[0].createdAt);
              
              // Use the earliest date between both
              startDate = earliestArticleDate < earliestUserDate ? 
                earliestArticleDate : earliestUserDate;
              
              // Round to first of month
              startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
              startDate.setHours(0, 0, 0, 0);
              
              // Create points for each month from start to now
              const endDate = new Date();
              let currentDate = new Date(startDate);
              
              while (currentDate <= endDate) {
                datePoints.push(new Date(currentDate));
                // Move to next month
                currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
              }
            }
          }
          
          // Create data series for both users and articles
          const labels = datePoints.map(date => {
            if (selectedPeriod === 'month') {
              return date.toLocaleDateString('it-IT', { 
                day: 'numeric',
                month: 'short'
              });
            } else if (selectedPeriod === 'year') {
              return date.toLocaleDateString('it-IT', { month: 'long' });
            } else {
              return date.toLocaleDateString('it-IT', { 
                month: 'short',
                year: 'numeric'
              });
            }
          });
          
          // Calculate new articles at each point
          const newArticlesByDate = datePoints.map(date => {
            // Get next date for range calculation
            const nextDate = new Date(date);
            if (selectedPeriod === 'month') {
              nextDate.setDate(nextDate.getDate() + 1);
            } else {
              nextDate.setMonth(nextDate.getMonth() + 1);
            }
            
            // Count articles in this date range
            const articlesInPeriod = articles.filter(article => {
              const articleDate = new Date(article.createdAt);
              return articleDate >= date && articleDate < nextDate;
            });
            
            // Debug articles in this period
            if (articlesInPeriod.length > 0) {
              console.log(`Found ${articlesInPeriod.length} articles in period:`, 
                date.toISOString(), ' to ', nextDate.toISOString(),
                articlesInPeriod.map(a => new Date(a.createdAt).toISOString())
              );
            }
            
            return articlesInPeriod.length;
          });
          
          // Calculate cumulative article counts
          const cumulativeArticlesByDate = newArticlesByDate.reduce((acc, count, index) => {
            // Add current count to previous cumulative total
            const total = index === 0 ? count : acc[index - 1] + count;
            acc.push(total);
            return acc;
          }, [] as number[]);
          
          // Calculate new users at each point
          const newUsersByDate = datePoints.map(date => {
            // Get next date for range calculation
            const nextDate = new Date(date);
            if (selectedPeriod === 'month') {
              nextDate.setDate(nextDate.getDate() + 1);
            } else {
              nextDate.setMonth(nextDate.getMonth() + 1);
            }
            
            // Count users in this date range
            return recentUsers.filter(user => {
              const userDate = new Date(user.createdAt);
              return userDate >= date && userDate < nextDate;
            }).length;
          });
          
          // Calculate cumulative user counts
          const cumulativeUsersByDate = newUsersByDate.reduce((acc, count, index) => {
            // Add current count to previous cumulative total
            const total = index === 0 ? count : acc[index - 1] + count;
            acc.push(total);
            return acc;
          }, [] as number[]);
          
          // Create tooltip labels with both new and cumulative counts
          const detailedLabels = datePoints.map((date, i) => {
            return `${date.toLocaleDateString('it-IT', { 
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}:\nNuovi Utenti: ${newUsersByDate[i]} (Totale: ${cumulativeUsersByDate[i]})\nNuovi Articoli: ${newArticlesByDate[i]} (Totale: ${cumulativeArticlesByDate[i]})`;
          });
          
          // Update chart data
          setUserRegData({
            labels,
            datasets: [
              {
                label: 'Utenti Totali',
                data: cumulativeUsersByDate,
                backgroundColor: 'rgba(147, 51, 234, 0.2)',
                borderColor: 'rgba(147, 51, 234, 1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: selectedPeriod === 'month' && datePoints.length > 10 ? 0 : 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'white',
                pointBorderColor: 'rgba(147, 51, 234, 1)',
                pointBorderWidth: 2,
              },
              {
                label: 'Articoli Totali',
                data: cumulativeArticlesByDate,
                backgroundColor: 'rgba(20, 184, 166, 0.2)',
                borderColor: 'rgba(20, 184, 166, 1)',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: selectedPeriod === 'month' && datePoints.length > 10 ? 0 : 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'white',
                pointBorderColor: 'rgba(20, 184, 166, 1)',
                pointBorderWidth: 2,
              }
            ],
            _detailedLabels: detailedLabels
          });
        }
      }
    });

    return () => unsubscribe();
  }, [recentUsers, selectedPeriod]);

  // Real-time listener for users
  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val() as Record<string, FirebaseUser>;
        const users = Object.entries(usersData).map(([id, data]) => ({
          id,
          displayName: data.displayName || 'Utente senza nome',
          email: data.email || 'Email non disponibile',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          role: data.role || 'utente',
          provider: data.provider || 'Email'
        }));
        
        setRecentUsers(users);
        setDisplayedUsers(users.length); // Update counter in real-time
        generateUserRegistrationData(users, articlesData, selectedPeriod);
      }
    });

    return () => unsubscribe();
  }, [articlesData, selectedPeriod]);

  // Add real-time listener for views, likes and shares
  useEffect(() => {
    const statsRef = ref(db, 'stats');
    const unsubscribe = onValue(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        const stats = snapshot.val();
        if (stats.views) setDisplayedViews(stats.views);
        if (stats.likes) setDisplayedLikes(stats.likes);
        if (stats.shares) setDisplayedShares(stats.shares);
      }
    });

    return () => unsubscribe();
  }, []);
  
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Storico Iscrizioni</h2>
              
              {/* Time period filters */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Periodo:</span>
                <div className="flex bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
                  {[
                    { id: 'month', label: 'Mese' },
                    { id: 'year', label: 'Anno' },
                    { id: 'all', label: 'Tutti' },
                  ].map((period) => (
                    <button
                      key={period.id}
                      onClick={() => setSelectedPeriod(period.id as TimePeriod)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        selectedPeriod === period.id
                          ? 'bg-indigo-500 text-white'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="animate-pulse h-64 bg-zinc-100 dark:bg-zinc-700 rounded-lg"></div>
            ) : (
              <div className="h-64">
                {userRegData.labels.length > 0 ? (
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
                          callbacks: {
                            title: function(tooltipItems) {
                              const item = tooltipItems[0];
                              const dataIndex = item.dataIndex;
                              
                              // Use detailed labels if available
                              if (userRegData._detailedLabels && userRegData._detailedLabels[dataIndex]) {
                                return userRegData._detailedLabels[dataIndex];
                              }
                              
                              // Fallback to regular label
                              const label = item.label || '';
                              return `Data: ${label}`;
                            },
                            label: function() {
                              // Don't need to show the value again since it's in the title
                              return '';
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true, // Start at zero for better readability
                          ticks: {
                            color: 'rgb(156, 163, 175)',
                            precision: 0, // Only show integers
                            callback: function(value) {
                              // Only label integers
                              if (typeof value === 'number') {
                                return value % 1 === 0 ? value : '';
                              }
                              return '';
                            },
                            maxTicksLimit: 6 // Limit number of y-axis ticks for a cleaner look
                          },
                          grid: {
                            color: 'rgba(156, 163, 175, 0.1)'
                          },
                          title: {
                            display: true,
                            text: 'Utenti Totali',
                            color: 'rgb(156, 163, 175)',
                            font: {
                              size: 12
                            }
                          }
                        },
                        x: {
                          ticks: {
                            color: 'rgb(156, 163, 175)',
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 12, // Limit number of ticks for cleaner look
                            font: {
                              size: 11 // Slightly larger font for better readability
                            }
                          },
                          grid: {
                            display: false
                          },
                          title: {
                            display: true,
                            text: selectedPeriod === 'month' ? 'Giorno del mese' : 
                                  selectedPeriod === 'year' ? 'Mese' : 'Data',
                            color: 'rgb(156, 163, 175)',
                            font: {
                              size: 12
                            },
                            padding: { top: 10 }
                          }
                        }
                      },
                      interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                      },
                      elements: {
                        line: {
                          cubicInterpolationMode: 'monotone', // Make curves more natural
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center flex-col">
                    <div className="text-zinc-500 dark:text-zinc-400 text-lg font-medium mb-2">
                      Nessun dato disponibile
                    </div>
                    <div className="text-zinc-400 dark:text-zinc-500 text-sm">
                      Non ci sono registrazioni nel periodo selezionato
                    </div>
                  </div>
                )}
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