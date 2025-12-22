"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase"; 