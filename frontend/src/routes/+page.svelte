<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAuth } from '$lib/stores/auth.svelte';

	const auth = getAuth();

	$effect(() => {
		if (!auth.loading) {
			goto(auth.isLoggedIn ? '/feed' : '/auth');
		}
	});
</script>
