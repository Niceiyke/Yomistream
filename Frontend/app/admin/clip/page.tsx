"use client"

import React, { useEffect, useState } from "react"
import { apiGet, apiPost, apiDelete } from "@/lib/api"
import { getAccessTokenCached } from "@/lib/auth-cache"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

interface JobStatus {
  job_id: string
  status: string
  progress: string
  video_id?: string | null
  video_url?: string | null
  error?: string | null
  created_at: string
  completed_at?: string | null
}

interface JobsResponse {
  jobs: JobStatus[]
}

export default function AdminClipPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [title, setTitle] = useState("Clipped Video")
  const [description, setDescription] = useState("This is a clipped segment.")
  const [webhookUrl, setWebhookUrl] = useState("")
  const queryClient = useQueryClient()

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getAccessTokenCached()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const jobsQuery = useQuery<JobsResponse>({
    queryKey: ["admin", "clip", "jobs"],
    queryFn: async () => {
      return apiGet("/api/clip/jobs", { headers: await authHeaders() })
    },
    // keep previous data while refetching
    staleTime: 5 * 1000,
    // Poll while any job is pending/processing so UI updates automatically
    refetchInterval: (query) => {
      try {
        const data = (query.state as any)?.data as JobsResponse | undefined
        const jobs: JobStatus[] = data?.jobs || []
        const shouldPoll = jobs.some((j) => j.status === "processing" || j.status === "pending")
        return shouldPoll ? 3000 : false
      } catch {
        return false
      }
    },
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    // initial load handled by react-query
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload: any = {
        video_url: videoUrl,
        start_time: startTime,
        end_time: endTime,
        title,
        description,
      }
      if (webhookUrl) payload.webhook = { url: webhookUrl }
      const created = await apiPost("/api/clip", payload, { headers: await authHeaders() })
      // Optimistically insert the returned job into the cache so it appears immediately
      try {
        queryClient.setQueryData(["admin", "clip", "jobs"], (old: any) => {
          const existing = old?.jobs || []
          return { jobs: [created, ...existing] }
        })
      } catch {}
      // Kick off a revalidation (will poll automatically if job is processing)
      await queryClient.invalidateQueries({ queryKey: ["admin", "clip", "jobs"] })
      // clear simple form
      setVideoUrl("")
      setStartTime("")
      setEndTime("")
    } catch (err) {
      console.error("Create clip failed", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (jobId: string) => {
    try {
      await apiDelete(`/api/clip/job/${jobId}`, { headers: await authHeaders() })
      await queryClient.invalidateQueries({ queryKey: ["admin", "clip", "jobs"] })
    } catch (err) {
      console.error("Delete job failed", err)
    }
  }

  const jobs: JobStatus[] = (jobsQuery.data?.jobs ?? []) as JobStatus[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Clip Jobs</h1>
          <div className="text-gray-300">Create and monitor clipping jobs</div>
        </div>

        <Card className="bg-white/5 border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Create Clip Job</CardTitle>
            <CardDescription className="text-gray-300">Submit a video URL and time range to create a clip job</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <Label className="text-white">Video URL</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="https://youtube.com/watch?v=..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white">Start Time (e.g. 00:01:30 or seconds)</Label>
                  <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="00:01:30" required />
                </div>
                <div>
                  <Label className="text-white">End Time</Label>
                  <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="00:02:30" required />
                </div>
              </div>
              <div>
                <Label className="text-white">Webhook URL (optional)</Label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="bg-slate-700 border-slate-600 text-white" placeholder="https://example.com/webhook" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Create Job"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Jobs</CardTitle>
            <CardDescription className="text-gray-300">Recent clipping jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-300">Job ID</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Progress</TableHead>
                    <TableHead className="text-gray-300">Video</TableHead>
                    <TableHead className="text-gray-300">Created</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.job_id} className="border-white/10">
                      <TableCell className="text-white font-mono text-xs">{j.job_id}</TableCell>
                      <TableCell>
                        <Badge className="uppercase text-xs" variant={j.status === "completed" ? "secondary" : "outline"}>{j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">{j.progress}{j.error ? ` — ${j.error}` : ""}</TableCell>
                      <TableCell className="text-gray-300">
                        {j.video_url ? (
                          <a href={j.video_url} target="_blank" rel="noreferrer" className="text-blue-300 underline">Open</a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">{new Date(j.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10">Delete</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-800 border-slate-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Delete Job</AlertDialogTitle>
                                <div className="text-gray-300">Are you sure you want to delete this job? This cannot be undone.</div>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(j.job_id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
