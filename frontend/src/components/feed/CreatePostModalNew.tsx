import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image,
  Video,
  BarChart3,
  X,
  Plus,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";

export interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export const CreatePostModalNew = ({
  isOpen,
  onClose,
  onPostCreated,
}: CreatePostModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);

  type CreatePostPayload = Parameters<typeof backendApi.posts.createPost>[0];
  // Create post mutation
  // const createPostMutation = useMutation({
  //   mutationFn: (data: {
  //     content: string;
  //     post_type?: string;
  //     visibility?: string;
  //     media?: Array<{ url: string; media_type: string; thumbnail_url?: string | null }>;
  //     poll?: {
  //       question: string;
  //       options: Array<{ option_text: string; display_order: number }>;
  //       ends_at?: string;z
  //     };
  //     scheduled_at?: string;
  //     is_draft?: boolean;
  //   }) => backendApi.posts.createPost(data),
  //   onSuccess: () => {
  //     toast({ title: "Post created successfully!" });
  //     resetForm();
  //     onClose();
  //     onPostCreated?.();
  //   },
  //   onError: (error: Error) => {
  //     toast({
  //       title: "Failed to create post",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   },
  // });
  const createPostMutation = useMutation({
  mutationFn: (data: CreatePostPayload) => backendApi.posts.createPost(data),
  onSuccess: () => {
    toast({ title: "Post created successfully!" });
    resetForm();
    onClose();
    onPostCreated?.();
  },
  onError: (error: Error) => {
    toast({
      title: "Failed to create post",
      description: error.message,
      variant: "destructive",
    });
  },
});

  const resetForm = () => {
    setContent("");
    setMediaUrls([]);
    setMediaInput("");
    setShowPoll(false);
    setPollOptions(["", ""]);
    setPollDuration(24);
  };

  const handleSubmit = () => {
    if (!content.trim() && mediaUrls.length === 0) {
      toast({ title: "Please add some content", variant: "destructive" });
      return;
    }
    // MAKE CHANGES HERE
    // const postData: any = {
    //   content: content.trim(),
    //   post_type: "text",
    //   visibility: "public",
    //   is_draft: false,
    // };

    type CreatePostPayload = Parameters<typeof backendApi.posts.createPost>[0];

    const postData: CreatePostPayload = {
      content: content.trim(),
      post_type: "text",
      visibility: "public",
      is_draft: false,
    };

    // Add media if URLs are provided
    if (mediaUrls.length > 0) {
      postData.media = mediaUrls.map(url => ({
        url: url,
        media_type: url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? "image" : "video",
        thumbnail_url: null
      }));
      // Set post type based on first media
      const firstUrl = mediaUrls[0];
      postData.post_type = firstUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? "image" : "video";
    }

    // Add poll if enabled
    if (showPoll && pollOptions.filter(opt => opt.trim()).length >= 2) {
      const validOptions = pollOptions.filter(opt => opt.trim());
      const endsAt = new Date();
      endsAt.setHours(endsAt.getHours() + pollDuration);

      postData.poll = {
        question: content.trim(),
        options: validOptions.map((opt, idx) => ({
          option_text: opt.trim(),
          display_order: idx
        })),
        ends_at: endsAt.toISOString()
      };
      postData.post_type = "poll";
    }

    createPostMutation.mutate(postData);
  };

  const addMediaUrl = () => {
    if (mediaInput.trim()) {
      setMediaUrls([...mediaUrls, mediaInput.trim()]);
      setMediaInput("");
    }
  };

  const removeMediaUrl = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <UserAvatar
              name={user?.email || "User"}
              size="md"
            />
            <div>
              <p className="font-semibold">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Post to Public</p>
            </div>
          </div>

          {/* Content Input */}
          <Textarea
            placeholder="What do you want to talk about?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="resize-none text-lg"
          />

          {/* Media URLs */}
          {mediaUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Media:</p>
              {mediaUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <img
                    src={url}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/64?text=Image";
                    }}
                  />
                  <span className="flex-1 text-sm truncate">{url}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMediaUrl(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add Media URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter image/video URL"
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMediaUrl();
                }
              }}
            />
            <Button onClick={addMediaUrl} variant="outline">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Poll Section */}
          {showPoll && (
            <div className="space-y-3 p-4 border rounded">
              <div className="flex items-center justify-between">
                <p className="font-medium">Poll</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPoll(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {pollOptions.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removePollOption(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              {pollOptions.length < 4 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addPollOption}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              )}

              <Select
                value={pollDuration.toString()}
                onValueChange={(value) => setPollDuration(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">1 day</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { }}
                title="Add image/video"
              >
                <Image className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPoll(!showPoll)}
                title="Create poll"
                disabled={showPoll}
              >
                <BarChart3 className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={createPostMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createPostMutation.isPending || (!content.trim() && mediaUrls.length === 0)}
              >
                {createPostMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
