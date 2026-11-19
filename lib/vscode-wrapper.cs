using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Native executable entry point required by VS Code's Windows SDK spawn contract.
class ClaudingVSCode {
    const string Node = @"__CLAUDING_NODE__";
    const string Entry = @"__CLAUDING_ENTRY__";
    static IntPtr job;
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool SetInformationJobObject(IntPtr job, int type, ref ExtendedLimit info, uint length);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [StructLayout(LayoutKind.Sequential)] struct BasicLimit {
        public long processTime, jobTime;
        public uint flags;
        public UIntPtr minWorkingSet, maxWorkingSet;
        public uint activeProcesses;
        public UIntPtr affinity;
        public uint priority, scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters {
        public ulong readOps, writeOps, otherOps, readBytes, writeBytes, otherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit {
        public BasicLimit basic;
        public IoCounters io;
        public UIntPtr processMemory, jobMemory, peakProcessMemory, peakJobMemory;
    }
    // Quote Windows argv including empty strings, quotes, and trailing backslashes.
    static string Quote(string value) {
        StringBuilder result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') result.Append('\\', slashes * 2 + 1).Append(c);
            else result.Append('\\', slashes).Append(c);
            slashes = 0;
        }
        return result.Append('\\', slashes * 2).Append('"').ToString();
    }
    static ManualResetEvent Relay(Stream input, Stream output, bool closeOutput) {
        ManualResetEvent done = new ManualResetEvent(false);
        Thread worker = new Thread(delegate() {
            try {
                byte[] buffer = new byte[16384];
                int length;
                while ((length = input.Read(buffer, 0, buffer.Length)) > 0) {
                    output.Write(buffer, 0, length);
                    output.Flush();
                }
            }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
            finally { if (closeOutput) output.Dispose(); done.Set(); }
        });
        worker.IsBackground = true;
        worker.Start();
        return done;
    }
    static int Main(string[] args) {
        try {
            // Assign this shim before spawning so all descendants inherit the job.
            job = CreateJobObject(IntPtr.Zero, null);
            ExtendedLimit info = new ExtendedLimit();
            info.basic.flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if (job == IntPtr.Zero || !SetInformationJobObject(job, 9, ref info, (uint)Marshal.SizeOf(info)) ||
                !AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle)) throw new Win32Exception();
            StringBuilder command = new StringBuilder(Quote(Entry));
            foreach (string arg in args) command.Append(' ').Append(Quote(arg));
            ProcessStartInfo start = new ProcessStartInfo(Node, command.ToString());
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.RedirectStandardInput = true;
            start.RedirectStandardOutput = true;
            start.RedirectStandardError = true;
            Console.InputEncoding = new UTF8Encoding(false);
            Console.OutputEncoding = new UTF8Encoding(false);
            // Relay bytes unchanged, including stream-json frames and Unicode.
            using (Process child = Process.Start(start)) {
                Relay(Console.OpenStandardInput(), child.StandardInput.BaseStream, true);
                ManualResetEvent output = Relay(child.StandardOutput.BaseStream, Console.OpenStandardOutput(), false);
                ManualResetEvent error = Relay(child.StandardError.BaseStream, Console.OpenStandardError(), false);
                child.WaitForExit();
                output.WaitOne();
                error.WaitOne();
                return child.ExitCode;
            }
        } catch (Exception error) {
            Console.Error.WriteLine("clauding-vscode: Windows wrapper failed: " + error.Message);
            return 1;
        }
    }
}
